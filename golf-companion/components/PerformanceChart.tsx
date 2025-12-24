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

  if (!chartData) {
    return (
      <ThemedView style={styles(palette).emptyContainer}>
        <ThemedText style={styles(palette).emptyText}>
          No data available yet. Play some rounds to see your progress!
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles(palette).container}>
      <ThemedText type="subtitle" style={styles(palette).title}>
        {chartData.chartTitle}
      </ThemedText>
      <LineChart
        data={chartData}
        width={screenWidth - 48}
        height={220}
        chartConfig={{
          backgroundColor: palette.white,
          backgroundGradientFrom: palette.white,
          backgroundGradientTo: palette.white,
          decimalPlaces: 0,
          color: (opacity = 1) => chartData.chartColor + Math.floor(opacity * 255).toString(16).padStart(2, '0'),
          labelColor: () => palette.textDark,
          style: { borderRadius: 16 },
          propsForDots: {
            r: '5',
            strokeWidth: '2',
            stroke: chartData.chartColor,
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
    </ThemedView>
  );
}

const styles = (palette: any) => StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
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