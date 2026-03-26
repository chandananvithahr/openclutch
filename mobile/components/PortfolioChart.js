import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors, spacing, radius, typography, financial } from '../styles/theme';

export default function PortfolioChart({ data }) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 80;

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

  const labelStride = Math.max(1, Math.ceil(data.labels.length / 4));

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

  const pointerConfig = useMemo(() => ({
    pointerStripUptoDataPoint: true,
    pointerStripColor: colors.primary,
    pointerStripWidth: 1,
    strokeDashArray: [4, 2],
    pointerColor: colors.primary,
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

  const chartSpacing = Math.floor(chartWidth / Math.max(points.length, 2));

  return (
    <View style={styles.container}>
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

      <View style={styles.chartContainer}>
        <LineChart
          data={points}
          width={chartWidth}
          height={120}
          color={isPositive ? colors.gain : colors.loss}
          thickness={2}
          startFillColor={isPositive ? colors.gain : colors.loss}
          endFillColor="transparent"
          startOpacity={0.25}
          endOpacity={0}
          areaChart
          curved
          hideDataPoints
          hideYAxisText
          xAxisColor={colors.border}
          rulesColor={colors.bgSubtle}
          noOfSections={3}
          maxValue={maxVal * 1.05}
          minValue={minVal * 0.95}
          yAxisLabelWidth={0}
          xAxisLabelTextStyle={styles.xLabel}
          spacing={chartSpacing}
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
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  label: { fontSize: typography.xs, color: colors.textMuted, marginBottom: 2 },
  currentValue: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.text,
    ...financial.amountStyle,
  },
  pnlBox: { alignItems: 'flex-end' },
  pnl: { fontSize: typography.sm + 1, fontWeight: typography.semibold, ...financial.amountStyle },
  positive: { color: colors.gain },
  negative: { color: colors.loss },
  chartContainer: { marginHorizontal: -4 },
  xLabel: { fontSize: 9, color: colors.textFaint },
  tooltipBox: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.sm,
    padding: 4,
    paddingHorizontal: 6,
  },
  tooltipText: { color: colors.text, fontSize: typography.xs, fontWeight: typography.semibold },
  footnote: { fontSize: 10, color: colors.textFaint, textAlign: 'right', marginTop: spacing.xs },
});
