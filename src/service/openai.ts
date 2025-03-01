import axios from 'axios';
import {getBackendSrv} from "@grafana/runtime";
import { PLUGIN_ID } from '../constants';
import {Context, DataModel, DataSchema} from "../components/AppConfig/AppConfig";

const windowQuery = "SELECT *\n" +
    ", COUNT(DISTINCT item) OVER(PARTITION BY DATE) AS distinct_count\n" +
    "FROM mytable;"

const createGPTData = (question: string, db_model: DataModel, db_schema: DataSchema, context: Context) => {

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
            content: `The query ${windowQuery} doesn’t work, because the Redshift documentation says 
                        “ALL is the default. DISTINCT is not supported.” Instead, one will need to use the DENSE_RANK() function to get this count, with the item to be counted in the ORDER BY window clause.`
        },{
            role: "developer",
            content: `For Redshift queries: avoid using functions in query predicates. Using them can drive up the cost of the query by requiring large numbers of rows to resolve the intermediate steps of the query.`
        },{
            role: "developer",
            content: `For Redshift queries: If possible, use a WHERE clause to restrict the dataset. The query planner can then use row order to help determine which records match the criteria, so it can skip scanning large numbers of disk blocks. Without this, the query execution engine must scan participating columns entirely.`
        },{
            role: "developer",
            content: `For Redshift queries: Add predicates to filter tables that participate in joins, even if the predicates apply the same filters. The query returns the same result set, but Amazon Redshift is able to filter the join tables before the scan step and can then efficiently skip scanning blocks from those tables. Redundant filters aren't needed if you filter on a column that's used in the join condition.`
        }, {
            role: "developer",
            content: schema_content,
        },
        {
            role: "user",
            content: `Here are the table models: ${table_content}\n\nHow can I query the model with Redshift to answer the question: "${question}"? Include the query parameters in the result.`,
        }, ...context.context],
        temperature: 0.7
    }
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
