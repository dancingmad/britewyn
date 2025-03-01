import React, {ChangeEvent, useEffect, useState} from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {Button, Collapse, Drawer, Field, FieldSet, Input, Select, useStyles2} from '@grafana/ui';
import { testIds } from '../components/testIds';
import {getBackendSrv, PluginPage} from '@grafana/runtime';
import { getScene } from "../scenes/mainScene";
import {askBackendForAQuery, askGPTForAQuery} from "../service/openai";
import {EmbeddedScene} from "@grafana/scenes";
import Markdown from 'react-markdown'
import { PLUGIN_ID } from '../constants';
import {Context, DataModel, DataSchema} from "../components/AppConfig/AppConfig";

const nullScene: EmbeddedScene | null = null;

const typeOptions = [
    { label: 'Bar Chart', value: 'barchart' },
    { label: 'Time Series', value: 'timeseries' },
    { label: 'Pie Chart', value: 'piechart' },
    { label: 'Single Stat', value: 'stat' },
    { label: 'Table View', value: 'table' },
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
            context: JSON.parse(response.jsonData.context),
        });
    })
}



function PageOne() {
    const [type, setType] = useState<string>("timeseries");
    const [apiKey, setApiKey] = useState<string>("");
    const [apiURL, setApiURL] = useState<string>("https://api.openai.com/v1/chat/completions");
    const [question, setQuestion] = useState<string>("How many card deposits were processed per day in January 2025 in the UK?");
    const s = useStyles2(getStyles);
    const [scene, setScene] = useState(nullScene);
    const [query, setQuery] = useState<string>();
    const [showQuery, setShowQuery] = useState<boolean>(false);
    const [apiKeyToggle, setApiKeyToggle] = useState<boolean>(false);
    const [settings, setSettings] = useState<Settings>();
    const [queryProcessing, setQueryProcessing] = useState<boolean>(false);


    const onChangeApiKey = (event: ChangeEvent<HTMLInputElement>) => {
        setApiKey(event.target.value);
    };
    const onChangeApiURL = (event: ChangeEvent<HTMLInputElement>) => {
        setApiURL(event.target.value);
    };
    const onChangeQuestion = (event: ChangeEvent<HTMLInputElement>) => {
        setQuestion(event.target.value);
    };

    useEffect(() => {
        getSettings(setSettings);
    }, []);

    useEffect(() => {
        if (type && query && settings) {
            setScene(getScene(type, query, settings.datasource));
        }
    }, [type, query, settings]);

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
                onChange={(v) => setType("" + v.value)}
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
            Welcome to the Payment AI. Please ask your question below and press Go.
            You can change the type of panel to display the result data.
            <FieldSet label="Ask Me Anything">
                <Collapse label="(optional) API" isOpen={apiKeyToggle} onToggle={() => setApiKeyToggle(!apiKeyToggle)}>
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
