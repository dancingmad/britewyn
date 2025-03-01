import { SceneQueryRunner } from '@grafana/scenes';

export const queryRunner = (rawSQL: string, datasource: string) => {
    return new SceneQueryRunner({
        datasource: {
            type: "grafana-postgresql-datasource",
            uid: datasource
        },
        queries: [
            {
                refId: 'A',
                editorMode: "code",
                format: "table",
                rawQuery: true,
                rawSql: rawSQL,
            },
        ]
    });
}
