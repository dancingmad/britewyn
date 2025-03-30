import axios from 'axios';
import {getBackendSrv} from "@grafana/runtime";
import { PLUGIN_ID } from '../constants';
import {Context, DataModel, DataSchema, Explanation} from "../components/AppConfig/AppConfig";

const panelOptionsSchema = {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Title of the panel"
      },
      description: {
        type: "string",
        description: "Description of the panel"
      },
      panelType: {
        type: "string",
        enum: ["timeseries", "barchart", "piechart", "stat", "table"],
        description: "Type of the visualization panel"
      },
      timeseries: {
        type: "object",
        description: "Timeseries specific options",
        properties: {
          legend: {
            type: "object",
            properties: {
              showLegend: { type: "boolean" },
              placement: { type: "string", enum: ["bottom", "right"] },
              calcs: { type: "array", items: { type: "string" } }
            }
          },
          tooltip: {
            type: "object",
            properties: {
              mode: { type: "string", enum: ["single", "multi", "none"] },
              sort: { type: "string", enum: ["none", "asc", "desc"] }
            }
          },
          series: {
            type: "object",
            properties: {
              lineWidth: { type: "number" },
              fillOpacity: { type: "number" },
              gradientMode: { type: "string", enum: ["none", "opacity", "hue"] },
              pointSize: { type: "number" },
              showPoints: { type: "string", enum: ["auto", "never", "always"] },
              spanNulls: { type: "boolean" }
            }
          },
          axes: {
            type: "object",
            properties: {
              x: {
                type: "object",
                properties: {
                  mode: { type: "string", enum: ["time"] }
                }
              },
              y: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  axisSoftMin: { type: "number" },
                  axisSoftMax: { type: "number" },
                  axisPlacement: { type: "string", enum: ["auto", "left", "right"] }
                }
              }
            }
          }
        }
      },
      barchart: {
        type: "object",
        description: "Bar chart specific options",
        properties: {
          orientation: { type: "string", enum: ["auto", "horizontal", "vertical"] },
          groupWidth: { type: "number" },
          showValue: { type: "string", enum: ["auto", "never", "always"] },
          stacking: { type: "string", enum: ["none", "normal", "percent"] },
          legend: {
            type: "object",
            properties: {
              showLegend: { type: "boolean" },
              placement: { type: "string", enum: ["bottom", "right"] }
            }
          }
        }
      },
      piechart: {
        type: "object",
        description: "Pie chart specific options",
        properties: {
          legend: {
            type: "object",
            properties: {
              showLegend: { type: "boolean" },
              placement: { type: "string", enum: ["bottom", "right"] }
            }
          },
          pieType: { type: "string", enum: ["pie", "donut"] },
          reduceOptions: {
            type: "object",
            properties: {
              values: { type: "boolean" },
              calcs: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      stat: {
        type: "object",
        description: "Stat specific options",
        properties: {
          textMode: { type: "string", enum: ["auto", "value", "value_and_name"] },
          colorMode: { type: "string", enum: ["value", "background"] },
          graphMode: { type: "string", enum: ["area", "none"] },
          reduceOptions: {
            type: "object",
            properties: {
              values: { type: "boolean" },
              calcs: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      table: {
        type: "object",
        description: "Table specific options",
        properties: {
          showHeader: { type: "boolean" },
          footer: {
            type: "object",
            properties: {
              show: { type: "boolean" },
              reducer: { type: "array", items: { type: "string" } }
            }
          },
          cellHeight: { type: "string", enum: ["sm", "md", "lg"] }
        }
      }
    },
    required: ["panelType"]
  };

interface GPTContext {
    model: string;
    messages: Explanation[];
    temperature: number;
    tools?: {
        type: string;
        function: {
            name: string;
            description: string;
            parameters: typeof panelOptionsSchema;
        };
    }[];
}

const windowQuery = "SELECT *\n" +
    ", COUNT(DISTINCT item) OVER(PARTITION BY DATE) AS distinct_count\n" +
    "FROM mytable;"

const createGPTData = (question: string, db_model: DataModel, db_schema: DataSchema, context: Context): GPTContext => {

    const schema_content: string = db_schema.fields.map((field) => {
        return `The possible values for ${field.field} are ${field.values}.`
    }).join('\n');

    const table_content: string = db_model.tables.map((table) => {
        const columns = table.columns.map((column) => {
            return `        ${column.name}: ${column.type}`
        }).join('\n');
        return `${table.table}: ${table.type}
    + columns
${columns}`
    }).join(',\n\n');

    return {
        model: "gpt-4o",
        messages: [{
            role: "developer",
            content:
                "You are an expert Redshift SQL assistant. Generate an appropriate Redshift SQL query based on the table models provided and answer the user's question. Use sysdate instead of function Now",
        },{
            role: "developer",
            content: `The query ${windowQuery} doesn't work, because the Redshift documentation says 
                        "ALL is the default. DISTINCT is not supported." Instead, one will need to use the DENSE_RANK() function to get this count, with the item to be counted in the ORDER BY window clause.`
        },{
            role: "developer",
            content: `For Redshift queries: avoid using functions in query predicates. Using them can drive up the cost of the query by requiring large numbers of rows to resolve the intermediate steps of the query.`
        },{
            role: "developer",
            content: `For Redshift queries: If possible, use a WHERE clause to restrict the dataset. The query planner can then use row order to help determine which records match the criteria, so it can skip scanning large numbers of disk blocks. Without this, the query execution engine must scan participating columns entirely.`
        },{
            role: "developer",
            content: `For Redshift queries: Add predicates to filter tables that participate in joins, even if the predicates apply the same filters. The query returns the same result set, but Amazon Redshift is able to filter the join tables before the scan step and can then efficiently skip scanning blocks from those tables. Redundant filters aren't needed if you filter on a column that's used in the join condition.`
        },{
            role: "developer",
            content: `When the query is including a timestamp expose the timestamp in the query result with the "time".`
        },{
            role: "developer",
            content: schema_content,
        },
        {
            role: "user",
            content: `Here are the table models: ${table_content}\n\nHow can I query the model with Redshift to answer the question: "${question}"? Include the query parameters in the result. Please name the timestamp column "time" and always order ascending if the answer to the question is a timeseries.`,
        }, ...context.context],
        temperature: 0.7
    }
}

const createGPTDataForPanelOptions = (question: string, db_model: DataModel, db_schema: DataSchema, context: Context, query: string) => {
    const previousContext = createGPTData(question, db_model, db_schema, context);
    previousContext.messages.push({
        role: "assistant",
        content: `Here is the query: ${query}`
    });
    previousContext.messages.push({
        role: "user",
        content: `How can I visualize the query in a dashboard panel?`
    });
    const tools = [
        {
            type: "function",
            function: {
                name: "create_panel",
                description: "Create a grafana visualization panel",
                parameters: panelOptionsSchema,
            },
        },
    ];
    previousContext.tools = tools;
    return previousContext;
}

export const askBackendForAQuery = (question: string, db_model: DataModel, db_schema: DataSchema, context: Context) => {
    //getBackendSrv().post(`${PLUGIN_BASE_URL}/resources/delegateRequestToAPI`)
    return getBackendSrv().post(`/api/plugins/${PLUGIN_ID}/resources/delegateRequestToAPI`,
        createGPTData(question,db_model, db_schema, context))
        .then((response: any) => {
            const query = extractQuery(response.choices[0].message.content);
            if (query) {
                return Promise.resolve({
                    message: "SUCCESS",
                    data: query
                });
            } else {
                return Promise.reject({
                    message: 'ERROR',
                    data: "SQL query not found in the response."
                });
            }
        }).catch((response: any) => {
            console.log(response);
            return Promise.reject({
                message: 'ERROR',
                data: response.message ? response.message : response.error.message
            });
        })
}

export const askGPTForPanelOptions = (apiKey: string, apiURL: string, question: string, db_model: DataModel, db_schema: DataSchema, context: Context, query: string) => {
    if (apiKey) {
        return axios(
            {
                method: 'post', url: apiURL,
                data: createGPTDataForPanelOptions(question, db_model, db_schema, context, query),
                headers: {
                    'Authorization': 'Bearer ' + apiKey,
                }
            })
            .then((response: any) => {
                const panelOptions = extractPanelOptions(response.data.choices[0].message.tool_calls);
                if (panelOptions) {
                    return Promise.resolve({
                        message: "SUCCESS",
                        data: panelOptions
                    });
                } else {
                    return Promise.reject({
                        message: 'ERROR',
                        data: "Panel options not found in the response."
                    });
                }
            }).catch((response: any) => {
                console.log(response);
                return Promise.reject({
                    message: 'ERROR',
                    data: response.message ? response.message : response.data.error.message
                });
            })
    } else {
        console.log('Missing Api Key');
        return Promise.reject({
            message: 'ERROR',
            data: 'missing api key'
        });
    }
}

export const askGPTForAQuery = (apiKey: string, apiURL: string, question: string, db_model: DataModel, db_schema: DataSchema, context: Context) => {

    if (apiKey) {
        return axios(
            {
                method: 'post', url: apiURL,
                data: createGPTData(question, db_model, db_schema, context),
                headers: {
                    'Authorization': 'Bearer ' + apiKey,
                }
            })
            .then((response: any) => {
                const query = extractQuery(response.data.choices[0].message.content);
                if (query) {
                    return Promise.resolve({
                        message: "SUCCESS",
                        data: query
                    });
                } else {
                    return Promise.reject({
                        message: 'ERROR',
                        data: "SQL query not found in the response."
                    });
                }
            }).catch((response: any) => {
                console.log(response);
                return Promise.reject({
                    message: 'ERROR',
                    data: response.message ? response.message : response.data.error.message
                });
            })
    } else {
        console.log('Missing Api Key');
        return Promise.reject({
            message: 'ERROR',
            data: 'missing api key'
        });
    }
}

const extractQuery = (content: string) => {

    const sqlMatch = content.match(/```sql\n([\s\S]*?)```/);

    if (sqlMatch && sqlMatch[1]) {
        console.log("Extracted SQL Query:");
        console.log(sqlMatch[1].trim());
        return sqlMatch[1].trim()
    } else {
        console.log("SQL query not found in the response.");
        return null;
    }
}

const extractPanelOptions = (tool_calls: any) => {
   if (tool_calls.length > 0) {
    return JSON.parse(tool_calls[0].function.arguments);
   } else {
    return null;
   }
}
