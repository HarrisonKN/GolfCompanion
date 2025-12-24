import { useEffect, useState } from 'react';
import { View, Dimensions, StyleSheet, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useTheme } from './ThemeContext';
import { supabase } from './supabase';

type ChartType = 'score' | 'putts' | 'fairways';

export function PerformanceChart({ userId, type = 'score' }: { userId: string; type?: ChartType }) {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { palette } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    loadData();
  }, [userId, type]);

  const loadData = async () => {
    try {
      const { data: rounds, error } = await supabase
        .from('golf_rounds')
        .select('date, score, putts, fairways_hit')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .limit(15);

      if (error) throw error;

      if (!rounds || rounds.length === 0) {
        setChartData(null);
        return;
      }

      const labels = rounds.map(r => {
        const date = new Date(r.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      });

      let dataPoints: number[];
      let chartTitle: string;
      let chartColor: string;

      switch (type) {
        case 'putts':
          dataPoints = rounds.map(r => r.putts || 0);
          chartTitle = 'Putts Per Round';
          chartColor = '#3b82f6';
          break;
        case 'fairways':
          dataPoints = rounds.map(r => r.fairways_hit || 0);
          chartTitle = 'Fairways Hit';
          chartColor = '#10b981';
          break;
        default:
          dataPoints = rounds.map(r => r.score);
          chartTitle = 'Score Trend';
          chartColor = palette.primary;
      }

      setChartData({
        labels,
        datasets: [{ data: dataPoints }],
        chartTitle,
        chartColor,
      });
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles(palette).loadingContainer}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  // Create empty chart data structure when no data exists
  const displayData = chartData || {
    labels: ['', '', '', '', ''],
    datasets: [{ data: [0, 0, 0, 0, 0] }],
    chartTitle: type === 'putts' ? 'Putts Per Round' : type === 'fairways' ? 'Fairways Hit' : 'Score Trend',
    chartColor: type === 'putts' ? '#3b82f6' : type === 'fairways' ? '#10b981' : palette.primary,
  };

  const isEmpty = !chartData;

  return (
    <ThemedView style={styles(palette).container}>
      <View style={styles(palette).titleContainer}>
        <ThemedText type="subtitle" style={styles(palette).title}>
          {displayData.chartTitle}
        </ThemedText>
        {isEmpty && (
          <ThemedText style={styles(palette).emptyBadge}>
            No data yet
          </ThemedText>
        )}
      </View>
      <View style={isEmpty ? styles(palette).chartContainerEmpty : undefined}>
        <LineChart
          data={displayData}
          width={screenWidth - 48}
          height={220}
          chartConfig={{
            backgroundColor: palette.white,
            backgroundGradientFrom: palette.white,
            backgroundGradientTo: palette.white,
            decimalPlaces: 0,
            color: (opacity = 1) => {
              const baseOpacity = isEmpty ? 0.15 : opacity;
              return displayData.chartColor + Math.floor(baseOpacity * 255).toString(16).padStart(2, '0');
            },
            labelColor: () => isEmpty ? palette.grey + '60' : palette.textDark,
            style: { borderRadius: 16 },
            propsForDots: {
              r: isEmpty ? '0' : '5',
              strokeWidth: '2',
              stroke: displayData.chartColor,
            },
            propsForBackgroundLines: {
              strokeDasharray: '',
              stroke: palette.grey + '40',
            },
          }}
          bezier
          style={styles(palette).chart}
          withInnerLines
          withOuterLines
          withVerticalLines={false}
        />
        {isEmpty && (
          <View style={styles(palette).emptyOverlay}>
            <ThemedText style={styles(palette).emptyOverlayText}>
              📊 Play rounds to populate this chart
            </ThemedText>
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = (palette: any) => StyleSheet.create({
  container: {
    marginVertical: 16,
    marginHorizontal: 24,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: {
    marginBottom: 0,
  },
  emptyBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textLight,
    backgroundColor: palette.grey + '30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartContainerEmpty: {
    position: 'relative',
    opacity: 0.5,
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emptyOverlayText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textLight,
    textAlign: 'center',
    backgroundColor: palette.white + 'E6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.grey + '40',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: palette.textLight,
  },
});