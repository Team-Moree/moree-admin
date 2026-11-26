import { useState } from 'react';
import { Button, Table } from 'antd';
import { TableOutlined, BarChartOutlined } from '@ant-design/icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, Cell } from 'recharts';
import { COLORS } from './ui';

export const SERIES_COLORS = [COLORS.blue, COLORS.red, COLORS.green, COLORS.purple, COLORS.orange, COLORS.pink];
export const NEUTRAL = COLORS.gray;

const AXIS_TICK = { fontSize: 12, fill: '#595959' };
const GRID = '#f0f0f0';
const ROW_HEIGHT = 30;

export function HBarChart({
  data,
  categoryKey,
  series,
  formatValue = (v) => v,
  label,
  colorOf,
  tooltipExtra,
  categoryWidth = 150,
  stacked = false,
}) {
  const height = Math.max(120, data.length * (series.length > 1 && !stacked ? ROW_HEIGHT * 1.25 : ROW_HEIGHT) + 48);
  const showLegend = series.length > 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: label || series.some((s) => s.label) ? 72 : 16, left: 0, bottom: 0 }}
        barGap={2}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} tickFormatter={formatValue} allowDecimals={false} />
        <YAxis type="category" dataKey={categoryKey} width={categoryWidth} tick={AXIS_TICK} interval={0} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          formatter={(v, name) => [formatValue(v), name]}
          labelFormatter={(l, payload) => {
            const extra = tooltipExtra && payload?.[0] ? tooltipExtra(payload[0].payload) : null;
            return extra ? `${l} · ${extra}` : l;
          }}
        />
        {showLegend && <Legend verticalAlign="top" height={28} iconType="circle" />}
        {series.map((s, i) => {
          const last = !stacked || i === series.length - 1;
          const barLabel = s.label || (last ? label : null);
          return (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              stackId={stacked ? 'stack' : undefined}
              barSize={series.length > 1 && !stacked ? 11 : 14}
              radius={last ? [0, 4, 4, 0] : 0}
              stroke="#fff"
              strokeWidth={stacked ? 2 : 0}
              isAnimationActive={false}
            >
              {colorOf && data.map((d) => <Cell key={d[categoryKey]} fill={colorOf(d)} />)}
              {barLabel && (
                <LabelList dataKey={barLabel.key} position="right" formatter={barLabel.format} style={{ fontSize: 12, fill: '#595959' }} />
              )}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartOrTable({ chart, columns, dataSource, rowKey }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4 }}>
        <Button
          size="small"
          type="text"
          icon={asTable ? <BarChartOutlined /> : <TableOutlined />}
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? '그래프로 보기' : '표로 보기'}
        </Button>
      </div>
      {asTable ? <Table columns={columns} dataSource={dataSource} rowKey={rowKey} pagination={false} size="small" /> : chart}
    </div>
  );
}
