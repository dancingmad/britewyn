import React, {ChangeEvent, useEffect, useState} from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {Button, Collapse, Drawer, Field, FieldSet, Input, Select, useStyles2} from '@grafana/ui';
import { testIds } from '../components/testIds';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import { getScene } from "../scenes/mainScene";
import {askBackendForAQuery, askGPTForAQuery, askGPTForPanelOptions} from "../service/openai";
import {EmbeddedScene} from "@grafana/scenes";
import Markdown from 'react-markdown'
import { PLUGIN_ID } from '../constants';
import {Context, DataModel, DataSchema} from "../components/AppConfig/AppConfig";
import { Datasource, emptyDatasource, fetchDataSources } from '../utils/config';
import { PanelBuilders } from '@grafana/scenes';

const nullScene: EmbeddedScene | null = null;

const typeOptions = [
    { label: 'Bar Chart', value: 'barchart' as keyof typeof PanelBuilders },
    { label: 'Time Series', value: 'timeseries' as keyof typeof PanelBuilders },
    { label: 'Pie Chart', value: 'piechart' as keyof typeof PanelBuilders },
    { label: 'Single Stat', value: 'stat' as keyof typeof PanelBuilders },
    { label: 'Table View', value: 'table' as keyof typeof PanelBuilders },
]

type Settings = {
    datasource: string;
    data_model: DataModel;
    data_schema: DataSchema;
    context: Context;
}

const getSettings = (setSettings: { (value: React.SetStateAction<Settings | undefined>): void; (arg0: Settings): void; }) => {
    getBackendSrv().get(`/api/plugins/${PLUGIN_ID}/settings`).then((response) => {
        setSettings({
            datasource: response.jsonData.datasource,
            data_model: JSON.parse(response.jsonData.db_model),
            data_schema: JSON.parse(response.jsonData.db_schema),
            context: JSON.parse(response.jsonData.context || "{}"),
        });
    })
}



function PageOne() {
    const [type, setType] = useState<keyof typeof PanelBuilders>("timeseries");
    const [apiKey, setApiKey] = useState<string>("");
    const [apiURL, setApiURL] = useState<string>("https://api.openai.com/v1/chat/completions");
    const [datasources, setDatasources] = useState([emptyDatasource]);
    const [datasource, setDatasource] = useState<string>("");
    const [question, setQuestion] = useState<string>("How many deposits per day did we process last month");
    const s = useStyles2(getStyles);
    const [scene, setScene] = useState(nullScene);
    const [query, setQuery] = useState<string>();
    const [panelOptions, setPanelOptions] = useState<any>();
    const [showQuery, setShowQuery] = useState<boolean>(false);
    const [apiKeyToggle, setApiKeyToggle] = useState<boolean>(false);
    const [settings, setSettings] = useState<Settings>();
    const [queryProcessing, setQueryProcessing] = useState<boolean>(false);
    
    useEffect(() => {
        const savedQuestion = localStorage.getItem("question");
        if (savedQuestion) setQuestion(savedQuestion);
        
        const savedDatasource = localStorage.getItem("datasource");
        if (savedDatasource) setDatasource(savedDatasource);

        const savedKey = localStorage.getItem("apiKey");
        if (savedKey) setApiKey(savedKey);

        const savedURL = localStorage.getItem("apiURL");
        if (savedURL) setApiURL(savedURL);

        const savedType = localStorage.getItem("type");
        if (savedType) setType(savedType as keyof typeof PanelBuilders);
    }, []);

    useEffect(() => {
        fetchDataSources(setDatasources)
      }, []);

    const onChangeApiKey = (event: ChangeEvent<HTMLInputElement>) => {
        localStorage.setItem("apiKey", event.target.value);
        setApiKey(event.target.value);
    };
    const onChangeApiURL = (event: ChangeEvent<HTMLInputElement>) => {
        localStorage.setItem("apiURL", event.target.value);
        setApiURL(event.target.value);
    };
    const onChangeQuestion = (event: ChangeEvent<HTMLInputElement>) => {
        localStorage.setItem("question", event.target.value);
        setQuestion(event.target.value);       
    };

    const onChangeDatasource = (v: SelectableValue<string>) => {
        localStorage.setItem("datasource", ""+v.value);
        setDatasource(""+v.value);
    }

    const getOptions = () => {
        return datasources ? datasources.map((d: Datasource) => { return  {
           label: (d.name + ":" + d.type),
               value: d.uid,
        }}) : [];
      }

    useEffect(() => {
        getSettings(setSettings);
    }, []);

    useEffect(() => {
        if (type && query && settings) {
            if (!panelOptions) {
                askGPTForPanelOptions(apiKey, apiURL, question, settings.data_model, settings.data_schema, settings.context, query).then((result) => {
                    setPanelOptions(result.data);
                });
            } else {
                setScene(getScene(type, panelOptions, query, datasource));
            }
        }
    }, [type, query, settings, panelOptions]);

    const askQuestion = () => {
        if (!settings?.data_model || !settings.data_schema) {
            return;
        }
        setQueryProcessing(true);
        if (apiKey) {
            console.log(`Asking the question ${question} via ${apiURL}`);
            askGPTForAQuery(apiKey, apiURL, question, settings.data_model, settings.data_schema, settings.context).then((result) => {
                setQueryProcessing(false);
                setQuery(result.data);
            }).catch((error) => {
                console.error(error);
            }).finally(() => setQueryProcessing(false))
        } else {
            console.log(`Asking the question ${question} via Backend`);
            askBackendForAQuery(question, settings.data_model, settings.data_schema, settings.context)
                .then((result) => {
                    setQuery(result.data);
                }).catch((error) => {
                    console.error(error);
                }).finally(() => setQueryProcessing(false))
        }
    }

    const panelPicker = scene ? (
        <div className={s.marginTop}>
            <Select
                onChange={(v) => {
                    if (v.value) {
                        localStorage.setItem("type", v.value);
                        setType(v.value as keyof typeof PanelBuilders)
                    }
                }}  
                value={type}
                options={typeOptions}
                width={60}/>
        </div>
    ):(<></>)
    const sceneBlock = scene ? (
        <div className={s.marginTop}>
            <scene.Component model={scene}/>
        </div>) : (<div className={s.marginTop}></div>)

    const markdownQueryAnswer = "``` sql\n"+query+"\n```";
    const showQueryButton = query ? (<button onClick={() => setShowQuery(true)}>Show Query</button>):(<></>)
    const queryDrawer = query && showQuery ? (<Drawer title="Query" size="md" onClose={() => setShowQuery(false)}>
        <Markdown>{markdownQueryAnswer}</Markdown>
    </Drawer>):(<></>)

    const goButton = !queryProcessing?(<Button onClick={askQuestion}>
        Go
    </Button>):<Button disabled={true}>
        Flying into the cloud for your question...
    </Button>

    // @ts-ignore
    return <PluginPage>
        <div data-testid={testIds.pageOne.container}>
            Welcome to the Britewyn Datasource AI. Please ask your question below and press Go.
            You can change the type of panel to display the result data and inspect the Query to verify it is correct.
            <FieldSet label="Ask Me Anything">
                <Collapse label="(optional) API" isOpen={apiKeyToggle} onToggle={() => setApiKeyToggle(!apiKeyToggle)}>
                     <Field label="Datasource" description="only PostgreSQL types supported at the moment" className={s.marginTop}>
                        <Select
                            onChange={onChangeDatasource}
                            value={datasource}
                            options={getOptions()}
                            width={60}/>
                    </Field>
                    <Field label="API Key">
                        <Input
                            width={60}
                            id="openai-api-key"
                            name="apiKey"
                            value={apiKey}
                            placeholder={'Your optional OpenAI API key to ask directly from your browser'}
                            onChange={onChangeApiKey}
                        />
                    </Field>
                    <Field label="apiURL">
                        <Input
                            width={60}
                            id="openai-api-url"
                            name="apiURL"
                            value={apiURL}
                            placeholder={'The OpenAI API URL'}
                            onChange={onChangeApiURL}
                        />
                    </Field>
                </Collapse>

                <Field label="Question" description="" className={s.marginTop}>
                    <Input
                        width={90}
                        name="apiUrl"
                        id="config-api-url"
                        value={question}
                        placeholder={`Whats the most popular deposit method today?`}
                        onChange={onChangeQuestion}
                    />
                </Field>

                <div className={s.marginTop}>
                    {goButton}
                </div>
            </FieldSet>
            {panelPicker}
            {sceneBlock}
            {showQueryButton}{queryDrawer}
        </div>
    </PluginPage>;
}

export default PageOne;

const getStyles = (theme: GrafanaTheme2) => ({
    marginTop: css`
        margin-top: ${theme.spacing(2)};
    `,
});
