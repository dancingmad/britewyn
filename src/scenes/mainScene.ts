import {
    EmbeddedScene,
    SceneFlexLayout,
    SceneFlexItem,
    PanelBuilders,
    SceneTimeRange,
    SceneTimePicker,
} from '@grafana/scenes';
import {queryRunner} from "./queryRunner";  

/******
 * 
 * example of a timeseries panel
 *   "fieldConfig": {
    "defaults": {
      "custom": {
        "drawStyle": "line",
        "lineInterpolation": "linear",
        "barAlignment": 0,
        "barWidthFactor": 0.6,
        "lineWidth": 1,
        "fillOpacity": 0,
        "gradientMode": "none",
        "spanNulls": false,
        "insertNulls": false,
        "showPoints": "auto",
        "pointSize": 5,
        "stacking": {
          "mode": "none",
          "group": "A"
        },
        "axisPlacement": "auto",
        "axisLabel": "",
        "axisColorMode": "text",
        "axisBorderShow": false,
        "scaleDistribution": {
          "type": "linear"
        },
        "axisCenteredZero": false,
        "hideFrom": {
          "tooltip": false,
          "viz": false,
          "legend": false
        },
        "thresholdsStyle": {
          "mode": "off"
        },
        "lineStyle": {
          "fill": "solid"
        },
        "axisSoftMin": 0
      },
      "color": {
        "mode": "palette-classic"
      },
      "mappings": [],
      "thresholds": {
        "mode": "absolute",
        "steps": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 80
          }
        ]
      },
      "unit": "short",
      "decimals": 2
    },
    "overrides": []
  }
 */

export interface PanelOptions {
    // Common options for all panels
    title?: string;
    description?: string;
    
    // Timeseries specific options
    timeseries?: {
        legend?: {
            showLegend?: boolean;
            placement?: 'bottom' | 'right';
            calcs?: string[];
        };
        tooltip?: {
            mode?: 'single' | 'multi' | 'none';
            sort?: 'none' | 'asc' | 'desc';
        };
        series?: {
            lineWidth?: number;
            fillOpacity?: number;
            gradientMode?: 'none' | 'opacity' | 'hue';
            pointSize?: number;
            showPoints?: 'auto' | 'never' | 'always';
            spanNulls?: boolean;
        };
        axes?: {
            x?: { mode?: 'time' };
            y?: {
                label?: string;
                axisSoftMin?: number;
                axisSoftMax?: number;
                axisPlacement?: 'auto' | 'left' | 'right';
            };
        };
    };

    // Bar chart specific options
    barchart?: {
        orientation?: 'auto' | 'horizontal' | 'vertical';
        groupWidth?: number;
        showValue?: 'auto' | 'never' | 'always';
        stacking?: 'none' | 'normal' | 'percent';
        legend?: {
            showLegend?: boolean;
            placement?: 'bottom' | 'right';
        };
    };

    // Pie chart specific options
    piechart?: {
        legend?: {
            showLegend?: boolean;
            placement?: 'bottom' | 'right';
        };
        pieType?: 'pie' | 'donut';
        reduceOptions?: {
            values?: boolean;
            calcs?: string[];
        };
    };

    // Stat specific options
    stat?: {
        textMode?: 'auto' | 'value' | 'value_and_name';
        colorMode?: 'value' | 'background';
        graphMode?: 'area' | 'none';
        reduceOptions?: {
            values?: boolean;
            calcs?: string[];
        };
    };

    // Table specific options
    table?: {
        showHeader?: boolean;
        footer?: {
            show?: boolean;
            reducer?: string[];
        };
        cellHeight?: 'sm' | 'md' | 'lg';
    };
}

const configurePanelBuilder = (builder: any, options: PanelOptions, type: string) => {
    // Apply common options
    if (options.title) {
        builder.setTitle(options.title);
    }
    if (options.description) {
        builder.setDescription(options.description);
    }

    // Apply type-specific options
    const typeOptions = options[type as keyof PanelOptions];
    if (typeOptions) {
        Object.entries(typeOptions).forEach(([key, value]) => {
            if (value) {
                builder.setOption(key, value);
            }
        });
    }

    return builder;
};

const panel = (type: keyof typeof PanelBuilders, options: PanelOptions = {}) => {
    const builder = configurePanelBuilder(PanelBuilders[type](), options, type);
    return builder;
}

export function getScene(type: keyof typeof PanelBuilders, options: PanelOptions, sql: string, datasource: string) {
    return new EmbeddedScene({
        $data: queryRunner(sql, datasource, sql.indexOf("time") > -1 && type !== "table" ? "time_series" : "table"),
        $timeRange: new SceneTimeRange({ from: 'now-24h', to: 'now'}),
        controls: [new SceneTimePicker({})],
        body: new SceneFlexLayout({
            children: [
                new SceneFlexItem({
                    width: '100%',
                    height: 300,
                    body: panel(type, options)            
                    .setCustomFieldConfig("unit","locale")                    
                    .setOption("legend", { showLegend: true, placement: "right", displayMode: "table", calcs: ["mean", "sum"]})
                    .setOption("reduceOptions", { values: true,calcs: ["lastNotNull"]})
                    .build(),                
                }),
            ],
        }),
    });
}


