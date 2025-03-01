import {
    EmbeddedScene,
    SceneFlexLayout,
    SceneFlexItem,
    PanelBuilders,
    SceneTimeRange,
    SceneTimePicker,
} from '@grafana/scenes';
import {queryRunner} from "./queryRunner";

const panel = (type: string) => {

    switch (type) {
        case 'barchart': return PanelBuilders.barchart();
        case 'timeseries': return PanelBuilders.timeseries();
        case 'piechart': return PanelBuilders.piechart();
        case 'stat': return PanelBuilders.stat();
        case 'table': return PanelBuilders.table();
        default: return PanelBuilders.barchart();
    }
}

export function getScene(type: string, sql: string, datasource: string) {
    return new EmbeddedScene({
        $data: queryRunner(sql, datasource),
        $timeRange: new SceneTimeRange({ from: 'now-24h', to: 'now'}),
        controls: [new SceneTimePicker({})],
        body: new SceneFlexLayout({
            children: [
                new SceneFlexItem({
                    width: '100%',
                    height: 300,
                    body: panel(type)
                        .setTitle('Your Answer').build()
                }),
            ],
        }),
    });
}


