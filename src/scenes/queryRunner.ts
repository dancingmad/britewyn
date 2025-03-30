import { SceneQueryRunner } from '@grafana/scenes';

export const queryRunner = (rawSQL: string, datasource: string, format: string = "table") => {
    return new SceneQueryRunner({
        datasource: {
            type: "grafana-postgresql-datasource",
            uid: datasource
        },
        queries: [
            {
                refId: 'A',
                editorMode: "code",
                format: format,
                rawQuery: true,
                rawSql: rawSQL,
            },
        ]
    });
}
