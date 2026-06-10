import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProgressScreen({ session }: any) {
  const [loading, setLoading] = useState(true);
  const [weeklyLogs, setWeeklyLogs] = useState<any[]>([]);
  const [mealHistory, setMealHistory] = useState<any[]>([]);

  // 🌟 Active selected date state (Defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Safe helper function to generate YYYY-MM-DD local dates
  const getLocalDateOffsetString = (daysAgo: number) => {
    const localDate = new Date();
    localDate.setDate(localDate.getDate() - daysAgo);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchProgressData = async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // 1. Fetch last 7 days of daily_logs
      const startDateStr = getLocalDateOffsetString(7);
      const { data: logs, error: logsError } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("date", startDateStr)
        .order("date", { ascending: false });

      if (!logsError && logs) {
        setWeeklyLogs(logs);
        // Fallback to most recent log date if current selection is outside the list
        if (logs.length > 0 && !logs.some((l) => l.date === selectedDate)) {
          setSelectedDate(logs[0].date);
        }
      }

      // 2. Fetch all time analysis history for filtering
      const { data: history, error: historyError } = await supabase
        .from("analysis_history")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (!historyError && history) {
        setMealHistory(history);
      }
    } catch (error) {
      console.error("System error while fetching progress data:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProgressData();
    }, [session]),
  );

  // Helper to format date cleanly (e.g., 26 May)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }
  // 🌟 DELETE MEAL FUNCTION
  const handleDeleteMeal = async (mealId: string) => {
    try {
      // 1. Supabase'den sil
      const { error } = await supabase
        .from("analysis_history")
        .delete()
        .eq("id", mealId);

      if (error) throw error;

      // 2. Ekrandaki state'i anlık güncelle (Filtrele)
      setMealHistory((prev) => prev.filter((meal) => meal.id !== mealId));
    } catch (error) {
      console.error("Error deleting meal:", error);
      Alert.alert("Error", "Could not delete the meal. Please try again.");
    }
  };

  // 🌟 DYNAMIC FILTERING LOGIC:
  // Find current selected day log metrics
  const activeLog = weeklyLogs.find((l) => l.date === selectedDate) || {
    water_intake: 0,
    calorie_target: 2200,
  };

  // Filter meal history to only match selected card date
  const filteredMeals = mealHistory.filter((meal) => {
    const mealDateStr = new Date(meal.created_at).toISOString().split("T")[0];
    return mealDateStr === selectedDate;
  });

  // Calculate stats dynamically
  const totalEatenCalories = filteredMeals.reduce(
    (sum, m) => sum + (m.total_calories || 0),
    0,
  );
  const remainingCalories = activeLog.calorie_target - totalEatenCalories;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 110 }}
    >
      {/* Top Welcome Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress & History 📈</Text>
        <Text style={styles.headerSub}>
          Track your dietary journey over time
        </Text>
      </View>

      {/* SECTION 1: WEEKLY INSIGHT CARDS */}
      <Text style={styles.sectionTitle}>Weekly Insights</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.insightsScroll}
      >
        {weeklyLogs.length === 0 ? (
          <View style={styles.emptyCardHorizontal}>
            <Text style={styles.emptyText}>
              No data logged for this week yet.
            </Text>
          </View>
        ) : (
          weeklyLogs.map((log) => {
            const isSelected = log.date === selectedDate;
            return (
              <TouchableOpacity
                key={log.id}
                activeOpacity={0.9}
                onPress={() => setSelectedDate(log.date)}
                style={[styles.logCard, isSelected && styles.selectedLogCard]}
              >
                <Text
                  style={[styles.logDate, isSelected && styles.selectedText]}
                >
                  {formatDate(log.date)}
                </Text>
                <View
                  style={[
                    styles.divider,
                    isSelected && { backgroundColor: "#A5D6A7" },
                  ]}
                />

                <Text style={styles.statLabel}>Water Intake</Text>
                <Text
                  style={[styles.statValue, isSelected && styles.selectedText]}
                >
                  💧 {log.water_intake}{" "}
                  {log.water_intake === 1 ? "Glass" : "Glasses"}
                </Text>

                <Text style={[styles.statLabel, { marginTop: 8 }]}>
                  Calorie Target
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    {
                      color: isSelected ? "#FFF" : "#2E7D32",
                      fontWeight: "bold",
                    },
                  ]}
                >
                  🎯 {log.calorie_target} kcal
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* SECTION 2: REPORT PANEL FOR SELECTED DAY */}
      <Text style={styles.sectionTitle}>
        {formatDate(selectedDate)} Summary Report
      </Text>
      <View style={styles.reportContainer}>
        <View style={styles.reportRow}>
          <View style={styles.reportBlock}>
            <Text style={styles.reportLabel}>Daily Target</Text>
            <Text style={styles.reportValue}>
              {activeLog.calorie_target} <Text style={styles.unit}>kcal</Text>
            </Text>
          </View>
          <View style={styles.reportBlock}>
            <Text style={styles.reportLabel}>Calories Eaten</Text>
            <Text style={[styles.reportValue, { color: "#E65100" }]}>
              {totalEatenCalories} <Text style={styles.unit}>kcal</Text>
            </Text>
          </View>
          <View style={styles.reportBlock}>
            <Text style={styles.reportLabel}>Remaining</Text>
            <Text style={[styles.reportValue, { color: "#2E7D32" }]}>
              {remainingCalories < 0 ? 0 : remainingCalories}{" "}
              <Text style={styles.unit}>kcal</Text>
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { marginVertical: 14 }]} />

        <View style={styles.waterReportRow}>
          <Text style={styles.waterReportText}>💧 Total Water Logged:</Text>
          <Text style={styles.waterReportValue}>
            {activeLog.water_intake}{" "}
            {activeLog.water_intake === 1 ? "Glass" : "Glasses"}
          </Text>
        </View>
      </View>

      {/* SECTION 3: MEALS COMPONENT FOR SELECTED DAY */}
      <Text style={styles.sectionTitle}>
        {formatDate(selectedDate)} Meal Diary
      </Text>
      <View style={styles.historyListContainer}>
        {filteredMeals.length === 0 ? (
          <View style={styles.emptyCardFull}>
            <Text style={styles.emptyText}>
              No analyzed meals found for this date.
            </Text>
          </View>
        ) : (
          filteredMeals.map((meal) => (
            <View key={meal.id} style={styles.mealCard}>
              <View style={styles.mealHeaderRow}>
                <Text style={styles.mealName}>
                  🍲{" "}
                  {Array.isArray(meal.detections) && meal.detections[0]
                    ? meal.detections[0].label
                    : "Analyzed Meal"}
                </Text>

                {/* 🌟 Silme Butonu ve Kalori Yan Yana */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.mealCalorie}>
                    {meal.total_calories} kcal
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteMeal(meal.id)}
                    style={{ marginLeft: 12, padding: 4 }}
                  >
                    <Text
                      style={{
                        color: "#ef4444",
                        fontSize: 16,
                        fontWeight: "bold",
                      }}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.mealTime}>
                Logged at:{" "}
                {new Date(meal.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>

              {Array.isArray(meal.detections) && meal.detections.length > 1 && (
                <Text style={styles.ingredientsText}>
                  Includes:{" "}
                  {meal.detections.map((d: any) => d.label).join(", ")}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F4" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F7F4",
  },
  header: { paddingHorizontal: 24, marginTop: 24, marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#1e293b" },
  headerSub: { fontSize: 14, color: "#64748b", marginTop: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e293b",
    marginHorizontal: 24,
    marginTop: 22,
    marginBottom: 12,
  },
  insightsScroll: { paddingLeft: 24, paddingRight: 12 },

  // Card Defaults
  logCard: {
    backgroundColor: "#FFF",
    width: 150,
    padding: 16,
    borderRadius: 20,
    marginRight: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  // Selection Styles 🌟
  selectedLogCard: {
    backgroundColor: "#2E7D32",
    borderColor: "#1B5E20",
    elevation: 6,
    shadowColor: "#2E7D32",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
  },
  logDate: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
    textAlign: "center",
  },
  selectedText: { color: "#FFF" },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 10 },
  statLabel: { fontSize: 11, color: "#94a3b8", fontWeight: "500" },
  statValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#334155",
    marginTop: 2,
  },

  // Dashboard Report Section
  reportContainer: {
    backgroundColor: "#FFF",
    marginHorizontal: 24,
    padding: 18,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.03,
  },
  reportRow: { flexDirection: "row", justifyContent: "space-between" },
  reportBlock: { alignItems: "center", flex: 1 },
  reportLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    marginBottom: 4,
  },
  reportValue: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  unit: { fontSize: 11, fontWeight: "normal", color: "#94a3b8" },
  waterReportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  waterReportText: { fontSize: 14, fontWeight: "600", color: "#1565C0" },
  waterReportValue: { fontSize: 15, fontWeight: "bold", color: "#1976D2" },

  // List Items Configuration
  historyListContainer: { paddingHorizontal: 24 },
  mealCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    elevation: 1,
    borderLeftWidth: 5,
    borderLeftColor: "#3498db",
  },
  mealHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealName: { fontSize: 16, fontWeight: "bold", color: "#1e293b", flex: 0.75 },
  mealCalorie: { fontSize: 16, fontWeight: "bold", color: "#2E7D32" },
  mealTime: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  ingredientsText: {
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
    marginTop: 6,
    backgroundColor: "#f8fafc",
    padding: 6,
    borderRadius: 8,
  },

  emptyCardHorizontal: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    width: 310,
    justifyContent: "center",
    elevation: 1,
  },
  emptyCardFull: {
    backgroundColor: "#FFF",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    elevation: 1,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
  },
});
