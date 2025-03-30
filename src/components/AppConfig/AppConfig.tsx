import React, {ChangeEvent, useEffect, useState} from 'react';
import { lastValueFrom } from 'rxjs';
import { css } from '@emotion/css';
import {AppPluginMeta, GrafanaTheme2, PluginConfigPageProps, PluginMeta, SelectableValue} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import {Button, Field, FieldSet, Input, SecretInput, Select, TextArea, useStyles2} from '@grafana/ui';
import { testIds } from '../testIds';
import { Datasource, emptyDatasource, fetchDataSources } from '../../utils/config';
type AppPluginSettings = {
  apiUrl?: string;
  db_schema?: string;
  db_model?: string;
  datasource?: string;
  context?: string;
};

type State = {
  // The URL to reach our custom API.
  apiUrl: string;
  // Tells us if the API key secret is set.
  isApiKeySet: boolean;
  // A secret key for our custom API.
  apiKey: string;
  db_schema: string;
  db_model: string;
  datasource: string;
  context: string;
};


export type ModelColumn = {
  name: string,
  type: string,
}
export type ModelTable = {
  table: string;
  type: string;
  columns: ModelColumn[];
}

export type DataModel = {
   tables: ModelTable[]
}

export type SchemaField = {
  field: string;
  values: string[];
}
export type DataSchema = {
  fields: SchemaField[]
}

export type Explanation = {
   role: string,
   content: string,
}

export type Context = {
  context: Explanation[]
}


export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<AppPluginSettings>> {}



const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getStyles);
  const { enabled, pinned, jsonData, secureJsonFields } = plugin.meta;
  const [datasources, setDatasources] = useState([emptyDatasource]);
  const [state, setState] = useState<State>({
    apiUrl: jsonData?.apiUrl || '',
    db_schema: jsonData?.db_schema || '{}',
    db_model: jsonData?.db_model || '{}',
    context: jsonData?.context || '{ explanations: [""] }',
    apiKey: '',
    isApiKeySet: Boolean(secureJsonFields?.apiKey),
    datasource: jsonData?.datasource || '',
  });



  useEffect(() => {
    fetchDataSources(setDatasources)
  }, []);


  const isSubmitDisabled = Boolean(!state.apiUrl || (!state.isApiKeySet && !state.apiKey));

  const onResetApiKey = () =>
    setState({
      ...state,
      apiKey: '',
      isApiKeySet: false,
    });

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      [event.target.name]: event.target.value.trim(),
    });
  };
  const onChangeText = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setState({
      ...state,
      [event.target.name]: event.target.value.trim(),
    });
  };

  const onChangeDatasource = (v: SelectableValue<string>) => {
    setState({
      ...state,
      datasource: ""+v.value
    })
  }

  const checkModels = (dbModel: DataModel, dataSchema: DataSchema, context: Context) => {
    // iterating through all elements to check runtime errors on parsing (see in logs)
    const checkModel= dbModel.tables.map((table) => table.columns.map((column) => column.name+column.type));
    const checkSchema = dataSchema.fields.map((field) => field.values).join("");
    const parsedContext = context.context.map((context) => context.content+context.role);
    if (!checkModel || !checkSchema || !parsedContext) {
      throw new Error("Couldn't parse either model or schema, please check if valid");
    }
  }

  const onSubmit = () => {
    const parsedDataModel: DataModel = JSON.parse(state.db_model);
    const parsedDBSchema: DataSchema = JSON.parse(state.db_schema);
    const parsedContext: Context = JSON.parse(state.context);
    checkModels(parsedDataModel, parsedDBSchema, parsedContext);

    if (isSubmitDisabled) {
      return;
    }

    updatePluginAndReload(plugin.meta.id, {
      enabled,
      pinned,
      jsonData: {
        apiUrl: state.apiUrl,
        db_schema: JSON.stringify(parsedDBSchema),
        db_model: JSON.stringify(parsedDataModel),
        context: JSON.stringify(parsedContext),
        datasource: state.datasource,
      },
      // This cannot be queried later by the frontend.
      // We don't want to override it in case it was set previously and left untouched now.
      secureJsonData: state.isApiKeySet
        ? undefined
        : {
            apiKey: state.apiKey,
          },
    });
  };


  const getOptions = () => {
    return datasources.map((d: Datasource) => { return  {
       label: (d.name + ":" + d.type),
           value: d.uid,
    }});
  }

  const dataModelInput = (
      <FieldSet label="Data Model Settings">
        <div
            style={{
              width: 800
            }}
        >
          <Field label="DB Model" description="The Tables and it's column definitions">
            <TextArea
                cols={60}
                name="db_model"
                id="config-db-model"
                value={state.db_model}
                onChange={onChangeText}
            />
          </Field>
          <Field label="DB Schema" description="Description of possible values of the columns">
            <TextArea
                cols={60}
                name="db_schema"
                id="config-db-schema"
                value={state.db_schema}
                onChange={onChangeText}
            />
          </Field>
          <Field label="Context" description="AI Context to guide answers for this datamodel, like partion field or guardrails for queries">
            <TextArea
                cols={60}
                name="context"
                id="config-context"
                value={state.context}
                onChange={onChangeText}
            />
          </Field>
        </div>
      </FieldSet>

  )

  return (
        <FieldSet label="API Settings">
          <Field label="API Key" description="A secret key for authenticating to our custom API">
            <SecretInput
                width={60}
                id="config-api-key"
                data-testid={testIds.appConfig.apiKey}
            name="apiKey"
            value={state.apiKey}
            isConfigured={state.isApiKeySet}
            placeholder={'Your secret API key'}
            onChange={onChange}
            onReset={onResetApiKey}
          />
        </Field>

        <Field label="OpenAPI API Url" description="" className={s.marginTop}>
          <Input
            width={60}
            name="apiUrl"
            id="config-api-url"
            data-testid={testIds.appConfig.apiUrl}
            value={state.apiUrl}
            placeholder={`E.g.: https://api.openai.com/v1/chat/completions`}
            onChange={onChange}
          />
        </Field>
        <Field label="Datasource" description="only PostgreSQL types supported at the moment" className={s.marginTop}>
          <Select
              onChange={onChangeDatasource}
              value={state.datasource}
              options={getOptions()}
              width={60}/>
        </Field>
        {dataModelInput}
        <div className={s.marginTop}>
          <Button onClick={onSubmit} data-testid={testIds.appConfig.submit} disabled={isSubmitDisabled}>
            Save API settings
          </Button>
        </div>
      </FieldSet>
  );
};

export default AppConfig;

const getStyles = (theme: GrafanaTheme2) => ({
  colorWeak: css`
    color: ${theme.colors.text.secondary};
  `,
  marginTop: css`
    margin-top: ${theme.spacing(3)};
  `,
});

const updatePluginAndReload = async (pluginId: string, data: Partial<PluginMeta<AppPluginSettings>>) => {
  try {
    await updatePlugin(pluginId, data);

    // Reloading the page as the changes made here wouldn't be propagated to the actual plugin otherwise.
    // This is not ideal, however unfortunately currently there is no supported way for updating the plugin state.
    window.location.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
};

const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = await getBackendSrv().fetch({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });

  return lastValueFrom(response);
};
