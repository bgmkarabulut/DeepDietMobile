import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface HomeScreenProps {
  session: any;
  isGuest: boolean;
  onNavigateToAnalyze: () => void;
  onSignOut: () => void;
}

export default function HomeScreen({
  session,
  isGuest,
  onNavigateToAnalyze,
}: HomeScreenProps) {
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("User");

  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const [calorieTarget, setCalorieTarget] = useState(2200);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [inputTarget, setInputTarget] = useState("2200");

  const [waterIntake, setWaterIntake] = useState(0);
  const waterTarget = 8;

  // 🌟 YENİ STATE: Bugün analiz edilen yemeklerin anlık listesi
  const [todayMeals, setTodayMeals] = useState<any[]>([]);

  // Safe local date string generator (YYYY-MM-DD)
  const getLocalDateString = () => {
    const localDate = new Date();
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const [target, setTarget] = useState<any>(null);
  const [aiAdvice, setAiAdvice] = useState("");
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Name Management
      if (isGuest) {
        setDisplayName("Guest User");
      } else if (session?.user) {
        const { data: dbUser, error } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", session.user.id)
          .single();

        if (!error && dbUser?.full_name) {
          setDisplayName(dbUser.full_name);
        } else {
          const fallbackName = session.user.email?.split("@")[0] || "User";
          setDisplayName(
            fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1),
          );
        }
      }
      const { data: targetData } = await supabase
        .from("targets")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (targetData) {
        setTarget(targetData);
      }
      const todayStr = getLocalDateString();

      if (session?.user && !isGuest) {
        // 2. Fetch or Create daily_logs
        let { data: dailyLog, error: fetchError } = await supabase
          .from("daily_logs")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("date", todayStr)
          .maybeSingle();

        if (!dailyLog) {
          const { data: newLog } = await supabase
            .from("daily_logs")
            .insert([
              {
                user_id: session.user.id,
                date: todayStr,
                water_intake: 0,
                calorie_target: 2200,
              },
            ])
            .select()
            .single();
          dailyLog = newLog;
        }

        if (dailyLog) {
          setWaterIntake(dailyLog.water_intake || 0);
          setCalorieTarget(dailyLog.calorie_target || 2200);
          setInputTarget(String(dailyLog.calorie_target || 2200));
        }

        // 3. Fetch Today's Specific Meals
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: history } = await supabase
          .from("analysis_history")
          .select("*")
          .eq("user_id", session.user.id)
          .gte("created_at", todayStart.toISOString())
          .order("created_at", { ascending: false });

        let totalCal = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;

        if (history) {
          setTodayMeals(history); // Ana ekrandaki liste için kaydet
          history.forEach((record) => {
            totalCal += record.total_calories || 0;
            if (Array.isArray(record.detections)) {
              record.detections.forEach((d: any) => {
                totalProtein += d.protein || 0;
                totalCarbs += d.carbs || 0;
                totalFat += d.fat || 0;
              });
            }
          });
        }

        setTotals({
          calories: Math.round(totalCal),
          protein: Math.round(totalProtein),
          carbs: Math.round(totalCarbs),
          fat: Math.round(totalFat),
        });
      }
    } catch (error) {
      console.error("Dashboard core error:", error);
    } finally {
      setLoading(false);
    }
  };
  const fetchAIRecommendation = async () => {
    try {
      if (isGuest || !session?.user) return;

      setLoadingAdvice(true);

      // PROFILE
      const { data: profile } = await supabase
        .from("users")
        .select("age, height, weight, goal_weight")
        .eq("id", session.user.id)
        .single();

      // TARGETS
      const { data: targetData } = await supabase
        .from("targets")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      // DAILY LOGS (son 7 gün)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: history } = await supabase
        .from("analysis_history")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("created_at", sevenDaysAgo.toISOString());

      let totalCal = 0;
      let totalProtein = 0;

      if (history) {
        history.forEach((r) => {
          totalCal += r.total_calories || 0;
          if (Array.isArray(r.detections)) {
            r.detections.forEach((d: any) => {
              totalProtein += d.protein || 0;
            });
          }
        });
      }

      // 🔥 GERÇEK AI PAYLOAD
      const payload = {
        age: profile?.age,
        height: profile?.height,
        weight: profile?.weight,
        goal_weight: profile?.goal_weight,
        goal_type: targetData?.goal_type,
        activity_level: targetData?.activity_level,
        training_days: targetData?.training_days,
        average_calories_last_7_days: history?.length
          ? Math.round(totalCal / history.length)
          : 0,
        average_protein_last_7_days: history?.length
          ? Math.round(totalProtein / history.length)
          : 0,
      };

      const response = await fetch("http://192.168.1.5:8000/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: session.user.id }), // 🔥 FIX BURASI
      });

      const data = await response.json();
      setAiAdvice(data.response);
    } catch (err) {
      console.log("AI error:", err);
    } finally {
      setLoadingAdvice(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
      fetchAIRecommendation();
    }, [session, isGuest]),
  );

  const handleSaveCalorieTarget = async () => {
    const newTarget = parseInt(inputTarget, 10);
    if (isNaN(newTarget) || newTarget <= 0) {
      Alert.alert("Error", "Please enter a valid calorie target.");
      return;
    }

    if (!isGuest && session?.user) {
      const todayStr = getLocalDateString();
      const { error } = await supabase
        .from("daily_logs")
        .update({ calorie_target: newTarget })
        .eq("user_id", session.user.id)
        .eq("date", todayStr);

      if (!error) {
        setCalorieTarget(newTarget);
        setIsEditingTarget(false);
      }
    } else {
      setCalorieTarget(newTarget);
      setIsEditingTarget(false);
    }
  };
  // 🌟 DELETE TODAY'S MEAL FUNCTION
  const handleDeleteHomeMeal = async (mealId: string, mealCalories: number) => {
    if (isGuest) return;
    try {
      // 1. Supabase'den sil
      const { error } = await supabase
        .from("analysis_history")
        .delete()
        .eq("id", mealId);

      if (error) throw error;

      // 2. Ekrandaki listenin state'ini güncelle
      const updatedMeals = todayMeals.filter((meal) => meal.id !== mealId);
      setTodayMeals(updatedMeals);

      // 3. Kalori ve Makro Özetlerini Yeniden Hesapla
      let totalCal = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      updatedMeals.forEach((record) => {
        totalCal += record.total_calories || 0;
        if (Array.isArray(record.detections)) {
          record.detections.forEach((d: any) => {
            totalProtein += d.protein || 0;
            totalCarbs += d.carbs || 0;
            totalFat += d.fat || 0;
          });
        }
      });

      setTotals({
        calories: Math.round(totalCal),
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
      });
    } catch (error) {
      console.error("Error deleting home meal:", error);
    }
  };
  const handleAddWater = async () => {
    if (isGuest) {
      Alert.alert(
        "Restricted Area 🔒",
        "Please create a free account to track water intake.",
      );
      return;
    }
    const nextWaterValue = waterIntake + 1;
    if (session?.user) {
      const todayStr = getLocalDateString();
      await supabase
        .from("daily_logs")
        .update({ water_intake: nextWaterValue })
        .eq("user_id", session.user.id)
        .eq("date", todayStr);
      setWaterIntake(nextWaterValue);
    }
  };

  const handleRemoveWater = async () => {
    if (isGuest) {
      Alert.alert(
        "Restricted Area 🔒",
        "Please create a free account to track water intake.",
      );
      return;
    }
    if (waterIntake <= 0) return;
    const nextWaterValue = waterIntake - 1;
    if (session?.user) {
      const todayStr = getLocalDateString();
      await supabase
        .from("daily_logs")
        .update({ water_intake: nextWaterValue })
        .eq("user_id", session.user.id)
        .eq("date", todayStr);
      setWaterIntake(nextWaterValue);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  const remainingCalories = calorieTarget - totals.calories;
  // Progress Bar yüzdesi hesaplama (Maksimum %100)
  const progressPercent = Math.min(
    100,
    Math.max(0, (totals.calories / calorieTarget) * 100),
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Welcome Row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.username}>{displayName} 👋</Text>
          </View>
        </View>

        {/* 🌟 Gelişmiş Kalori Özet Kartı */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Daily Energy Budget</Text>

          <View style={styles.row}>
            {/* Target */}
            <View
              style={[styles.metricBlock, isGuest && styles.disabledElement]}
            >
              {isEditingTarget ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={styles.targetInput}
                    keyboardType="numeric"
                    value={inputTarget}
                    onChangeText={setInputTarget}
                    maxLength={5}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveCalorieTarget}
                  >
                    <Text style={styles.saveBtnText}>✓</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    if (isGuest) {
                      Alert.alert(
                        "Restricted Area 🔒",
                        "Please create a free account to set goals.",
                      );
                      return;
                    }
                    setIsEditingTarget(true);
                  }}
                  style={{ alignItems: "center" }}
                >
                  <Text style={styles.metricValue}>{calorieTarget}</Text>
                  <Text style={styles.editLabel}>Target ⚙️</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.operator}>-</Text>

            {/* Eaten */}
            <View style={styles.metricBlock}>
              <Text style={styles.metricValue}>{totals.calories}</Text>
              <Text style={styles.metricLabel}>Eaten</Text>
            </View>

            <Text style={styles.operator}>=</Text>

            {/* Remaining */}
            <View
              style={[
                styles.metricBlock,
                {
                  backgroundColor:
                    remainingCalories < 0 ? "#FFEBEE" : "#E8F5E9",
                  borderRadius: 16,
                  padding: 8,
                },
              ]}
            >
              <Text
                style={[
                  styles.metricValue,
                  { color: remainingCalories < 0 ? "#C62828" : "#2E7D32" },
                ]}
              >
                {remainingCalories < 0
                  ? Math.abs(remainingCalories)
                  : remainingCalories}
              </Text>
              <Text style={styles.metricLabel}>
                {remainingCalories < 0 ? "Over Limit" : "Remaining"}
              </Text>
            </View>
          </View>

          {/* 🌟 YENİ: VISUAL PROGRESS BAR */}
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressBar, { width: `${progressPercent}%` }]}
            />
          </View>
          <Text style={styles.progressPercentageText}>
            {Math.round(progressPercent)}% of daily budget consumed
          </Text>
        </View>

        {/* Macros Breakdown */}
        <Text style={styles.sectionTitle}>Macros Breakdown</Text>
        <View style={styles.macroContainerCard}>
          {/* Sol Taraf: Tamamen Native CSS ile Çizilen Özel Grafik Tasarımı */}
          <View style={styles.chartWrapper}>
            {/* Dış Halka: Carbs */}
            <View
              style={[
                styles.macroRing,
                {
                  width: 100,
                  height: 100,
                  borderColor: "#6b46c1",
                  borderWidth: 8,
                },
              ]}
            >
              {/* Orta Halka: Protein */}
              <View
                style={[
                  styles.macroRingInside,
                  {
                    width: 76,
                    height: 76,
                    borderColor: "#2b6cb0",
                    borderWidth: 8,
                  },
                ]}
              >
                {/* İç Halka: Fat */}
                <View
                  style={[
                    styles.macroRingInside,
                    {
                      width: 52,
                      height: 52,
                      borderColor: "#ed64a6",
                      borderWidth: 8,
                      backgroundColor: "#FFF",
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Sağ Taraf: Makroların Detaylı ve Renk Kodlu Listesi */}
          <View style={styles.macroLegendWrapper}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#2b6cb0" }]}
              />
              <View style={styles.legendTextColumn}>
                <Text style={styles.legendLabel}>Protein</Text>
                <Text style={styles.legendValue}>{totals.protein}g</Text>
              </View>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#6b46c1" }]}
              />
              <View style={styles.legendTextColumn}>
                <Text style={styles.legendLabel}>Carbs</Text>
                <Text style={styles.legendValue}>{totals.carbs}g</Text>
              </View>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: "#ed64a6" }]}
              />
              <View style={styles.legendTextColumn}>
                <Text style={styles.legendLabel}>Fat</Text>
                <Text style={styles.legendValue}>{totals.fat}g</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Water Log */}
        <View style={[styles.waterCard, isGuest && styles.disabledElement]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.waterTitle}>Water Log 💧</Text>
            <Text style={styles.waterProgress}>
              {waterIntake} {waterIntake === 1 ? "Glass" : "Glasses"}{" "}
              {waterIntake >= waterTarget ? "🎉" : ""}
            </Text>
          </View>
          <View style={styles.waterActionRow}>
            <TouchableOpacity
              style={[
                styles.waterMinusButton,
                waterIntake === 0 && { opacity: 0.4 },
              ]}
              onPress={handleRemoveWater}
              disabled={waterIntake === 0}
            >
              <Text style={styles.waterButtonText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.waterAddButton}
              onPress={handleAddWater}
            >
              <Text style={styles.waterButtonText}>+1 Glass</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>🤖 AI Coach</Text>

          {loadingAdvice ? (
            <ActivityIndicator color="#2E7D32" />
          ) : (
            <Text style={styles.aiText}>
              {aiAdvice || "Waiting for your nutrition insights..."}
            </Text>
          )}
        </View>

        {/* 🌟 YENİ BÖLÜM: TODAY'S SCAN HISTORY (Öğün Akışı) */}
        <Text style={styles.sectionTitle}>Today's Meals</Text>
        <View style={styles.mealsContainer}>
          {isGuest ? (
            <View style={styles.emptyMealsCard}>
              <Text style={styles.emptyMealsText}>
                Create an account to save and view your scanned meals here.
              </Text>
            </View>
          ) : todayMeals.length === 0 ? (
            <View style={styles.emptyMealsCard}>
              <Text style={styles.emptyMealsText}>
                No meals scanned today yet. Tap the '+' button below to analyze
                your food!
              </Text>
            </View>
          ) : (
            todayMeals.map((meal) => (
              <View key={meal.id} style={styles.homeMealCard}>
                <View style={styles.mealLeft}>
                  <Text style={styles.homeMealName}>
                    🍲{" "}
                    {Array.isArray(meal.detections) && meal.detections[0]
                      ? meal.detections[0].label
                      : "Analyzed Dish"}
                  </Text>
                  <Text style={styles.homeMealTime}>
                    {new Date(meal.created_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>

                {/* 🌟 Kalori ve Kırmızı Kapatma Butonu Yan Yana */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.homeMealCalories}>
                    +{meal.total_calories} kcal
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      handleDeleteHomeMeal(meal.id, meal.total_calories || 0)
                    }
                    style={{ marginLeft: 12, padding: 2 }}
                  >
                    <Text
                      style={{
                        color: "#ef4444",
                        fontSize: 14,
                        fontWeight: "bold",
                      }}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={onNavigateToAnalyze}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
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
  scrollContent: { padding: 24, paddingBottom: 110 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: { fontSize: 15, color: "#64748b" },
  username: { fontSize: 24, fontWeight: "bold", color: "#1e293b" },

  summaryCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 16,
  },
  aiCard: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  aiTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },

  aiText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  metricBlock: { alignItems: "center", minWidth: 80 },
  metricValue: { fontSize: 22, fontWeight: "bold", color: "#1e293b" },
  metricLabel: { fontSize: 12, color: "#64748b", marginTop: 4 },
  editLabel: {
    fontSize: 12,
    color: "#2E7D32",
    fontWeight: "500",
    marginTop: 4,
  },
  operator: { fontSize: 20, color: "#cbd5e1", fontWeight: "300" },
  editContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2E7D32",
  },
  targetInput: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
    padding: 2,
    width: 60,
    textAlign: "center",
  },
  saveBtn: {
    backgroundColor: "#2E7D32",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  saveBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },

  // 🌟 Progress Bar Styles
  progressTrack: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    marginTop: 20,
    overflow: "hidden",
  },
  progressBar: { height: "100%", backgroundColor: "#2E7D32", borderRadius: 4 },
  progressPercentageText: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "right",
    marginTop: 6,
    fontWeight: "500",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 14,
  },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  macroCard: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginHorizontal: 4,
    borderTopWidth: 4,
    elevation: 1,
  },
  macroValue: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  macroLabel: { fontSize: 12, color: "#64748b", marginTop: 4 },

  waterCard: {
    backgroundColor: "#E3F2FD",
    padding: 20,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  waterTitle: { fontSize: 16, fontWeight: "bold", color: "#1565C0" },
  waterProgress: { fontSize: 14, color: "#1E88E5", marginTop: 4 },
  waterActionRow: { flexDirection: "row", alignItems: "center" },
  waterMinusButton: {
    backgroundColor: "#ef4444",
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  waterAddButton: {
    backgroundColor: "#1976D2",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  waterButtonText: { color: "#FFF", fontWeight: "bold" },

  // 🌟 Today's Meals Card Styles
  mealsContainer: { marginBottom: 10 },
  emptyMealsCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  emptyMealsText: {
    color: "#94a3b8",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 18,
  },
  homeMealCard: {
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.01,
  },
  // 🌟 YENİ GRAFİKLİ MAKRO PANELİ STİLLERİ
  macroContainerCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  chartWrapper: {
    flex: 0.4,
    alignItems: "center",
    justifyContent: "center",
  },
  macroRing: {
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    borderStyle: "solid",
  },
  macroRingInside: {
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    borderStyle: "solid",
  },
  macroLegendWrapper: {
    flex: 0.55,
    flexDirection: "column",
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  legendTextColumn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flex: 1,
  },
  legendLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  legendValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1e293b",
  },
  mealLeft: { flexDirection: "column" },
  homeMealName: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  homeMealTime: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  homeMealCalories: { fontSize: 15, fontWeight: "bold", color: "#2E7D32" },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: "#2E7D32",
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  fabIcon: { color: "#FFF", fontSize: 36, fontWeight: "300", marginTop: -2 },
  disabledElement: { opacity: 0.4 },
});
