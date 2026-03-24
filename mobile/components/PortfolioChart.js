import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

export default function PortfolioChart({ data }) {
  // useWindowDimensions re-renders correctly on rotation / split-screen / foldables
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 80; // account for avatar + padding

  if (
    !data ||
    !data.labels ||
    !data.values ||
    data.values.length === 0 ||
    data.total_pnl == null ||
    data.total_pnl_percent == null ||
    data.current_value == null
  ) {
    return null;
  }

  const isPositive = data.total_pnl >= 0;

  // Derive label stride from data length so labels never crowd or go sparse
  const labelStride = Math.max(1, Math.ceil(data.labels.length / 4));

  // Build data points for gifted-charts LineChart
  const points = data.values.map((v, i) => ({
    value: v,
    label: i % labelStride === 0 ? data.labels[i] : '',
    dataPointText: '',
  }));

  const minVal = Math.min(...data.values);
  const maxVal = Math.max(...data.values);

  const formatINR = (num) => {
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(0)}K`;
    return `₹${Math.round(num)}`;
  };

  // Memoize pointerConfig to avoid re-creating on every FlatList scroll render
  const pointerConfig = useMemo(() => ({
    pointerStripUptoDataPoint: true,
    pointerStripColor: '#6C63FF',
    pointerStripWidth: 1,
    strokeDashArray: [4, 2],
    pointerColor: '#6C63FF',
    radius: 5,
    pointerLabelWidth: 80,
    pointerLabelHeight: 40,
    activatePointersOnLongPress: false,
    autoAdjustPointerLabelPosition: true,
    pointerLabelComponent: (items) => (
      <View style={styles.tooltipBox}>
        <Text style={styles.tooltipText}>{formatINR(items[0].value)}</Text>
      </View>
    ),
  }), []);

  // spacing: keep all points within chartWidth bounds
  const spacing = Math.floor(chartWidth / Math.max(points.length, 2));

  return (
    <View style={styles.container}>
      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.label}>Current Value</Text>
          <Text style={styles.currentValue}>{formatINR(data.current_value)}</Text>
        </View>
        <View style={styles.pnlBox}>
          <Text style={styles.label}>P&L</Text>
          <Text style={[styles.pnl, isPositive ? styles.positive : styles.negative]}>
            {isPositive ? '+' : ''}{formatINR(data.total_pnl)} ({data.total_pnl_percent}%)
          </Text>
        </View>
      </View>

      {/* Line chart */}
      <View style={styles.chartContainer}>
        <LineChart
          data={points}
          width={chartWidth}
          height={120}
          color={isPositive ? '#22c55e' : '#ef4444'}
          thickness={2}
          startFillColor={isPositive ? '#22c55e' : '#ef4444'}
          endFillColor="transparent"
          startOpacity={0.25}
          endOpacity={0}
          areaChart
          curved
          hideDataPoints
          hideYAxisText
          xAxisColor="#e0e0e0"
          rulesColor="#f0f0f0"
          noOfSections={3}
          maxValue={maxVal * 1.05}
          minValue={minVal * 0.95}
          yAxisLabelWidth={0}
          xAxisLabelTextStyle={styles.xLabel}
          spacing={spacing}
          initialSpacing={4}
          endSpacing={4}
          backgroundColor="transparent"
          pointerConfig={pointerConfig}
        />
      </View>

      <Text style={styles.footnote}>1-year portfolio history</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: { fontSize: 11, color: '#888', marginBottom: 2 },
  currentValue: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  pnlBox: { alignItems: 'flex-end' },
  pnl: { fontSize: 14, fontWeight: '600' },
  positive: { color: '#22c55e' },
  negative: { color: '#ef4444' },
  chartContainer: { marginHorizontal: -4 },
  xLabel: { fontSize: 9, color: '#aaa' },
  tooltipBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    padding: 4,
    paddingHorizontal: 6,
  },
  tooltipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  footnote: { fontSize: 10, color: '#bbb', textAlign: 'right', marginTop: 4 },
});
