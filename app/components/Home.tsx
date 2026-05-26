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
  onSignOut,
}: HomeScreenProps) {
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("Kullanıcı");

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

  // Yerel saat dilimine göre YYYY-MM-DD formatında tarih üreten güvenli fonksiyon
  const getLocalDateString = () => {
    const localDate = new Date();
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. İsim Yönetimi
      if (isGuest) {
        setDisplayName("Misafir Kullanıcı");
      } else if (session?.user) {
        const { data: dbUser, error } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", session.user.id)
          .single();

        if (!error && dbUser?.full_name) {
          setDisplayName(dbUser.full_name);
        } else {
          const fallbackName = session.user.email?.split("@")[0] || "Kullanıcı";
          setDisplayName(
            fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1),
          );
        }
      }

      const todayStr = getLocalDateString();

      if (session?.user && !isGuest) {
        // 2. Bugünün Verisini Çek (daily_logs)
        let { data: dailyLog, error: fetchError } = await supabase
          .from("daily_logs")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("date", todayStr)
          .maybeSingle();

        if (fetchError) {
          console.log(
            "⚠️ daily_logs çekilirken hata oluştu:",
            fetchError.message,
          );
        }

        // Eğer bugün için henüz log kaydı yoksa sıfırdan oluşturalım (INSERT)
        if (!dailyLog) {
          console.log(
            "✨ Bugün için daily_logs tablosunda ilk defa satır açılıyor...",
          );
          const { data: newLog, error: insertError } = await supabase
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

          if (insertError) {
            console.log(
              "❌ Satır oluşturma (INSERT) hatası:",
              insertError.message,
            );
          } else {
            dailyLog = newLog;
            console.log("✅ Satır başarıyla oluşturuldu.");
          }
        }

        if (dailyLog) {
          setWaterIntake(dailyLog.water_intake || 0);
          setCalorieTarget(dailyLog.calorie_target || 2200);
          setInputTarget(String(dailyLog.calorie_target || 2200));
        }

        // 3. Bugünün Yemek Analizlerini Çekip Topla
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: history } = await supabase
          .from("analysis_history")
          .select("total_calories, detections")
          .eq("user_id", session.user.id)
          .gte("created_at", todayStart.toISOString());

        let totalCal = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;

        if (history) {
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
      console.error("Dashboard yüklenirken sistem hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [session, isGuest]),
  );

  // KALORİ HEDEFİNİ KAYDETME
  const handleSaveCalorieTarget = async () => {
    const newTarget = parseInt(inputTarget, 10);
    if (isNaN(newTarget) || newTarget <= 0) {
      Alert.alert("Hata", "Lütfen geçerli bir kalori hedefi giriniz.");
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
        console.log("✅ Kalori hedefi başarıyla güncellendi.");
      } else {
        console.log(
          "❌ Kalori hedefi güncellenirken DB hatası:",
          error.message,
        );
        Alert.alert("Hata", "Hedef güncellenirken bir sorun oluştu.");
      }
    } else {
      setCalorieTarget(newTarget);
      setIsEditingTarget(false);
    }
  };

  // SU TAKİBİNİ KAYDETME
  // SU TAKİBİNİ KAYDETME (Üst Limit Kaldırıldı 🚀)
  const handleAddWater = async () => {
    // Misafir kilidi aynen kalıyor
    if (isGuest) {
      Alert.alert(
        "Kısıtlı Alan 🔒",
        "Su takibi özelliğini kullanabilmek için lütfen ücretsiz bir hesap oluşturun.",
      );
      return;
    }

    // 🌟 ARTIK 8 BARDAK SINIRI YOK! Kullanıcı içtiği kadar ekleyebilir:
    const nextWaterValue = waterIntake + 1;

    if (session?.user) {
      const todayStr = getLocalDateString();

      const { error } = await supabase
        .from("daily_logs")
        .update({ water_intake: nextWaterValue })
        .eq("user_id", session.user.id)
        .eq("date", todayStr);

      if (!error) {
        setWaterIntake(nextWaterValue);
        console.log("✅ Su bulutta güncellendi. Yeni değer:", nextWaterValue);
      } else {
        console.log("❌ Su güncellenirken DB hatası:", error.message);
      }
    }
  };
  const handleRemoveWater = async () => {
    if (isGuest) {
      Alert.alert(
        "Kısıtlı Alan 🔒",
        "Su takibi özelliğini kullanabilmek için lütfen ücretsiz bir hesap oluşturun.",
      );
      return;
    }

    // Sıfırın altına düşmeyi engelleme kontrolü
    if (waterIntake <= 0) return;

    const nextWaterValue = waterIntake - 1;

    if (session?.user) {
      const todayStr = getLocalDateString();
      const { error } = await supabase
        .from("daily_logs")
        .update({ water_intake: nextWaterValue })
        .eq("user_id", session.user.id)
        .eq("date", todayStr);

      if (!error) {
        setWaterIntake(nextWaterValue);
        console.log("✅ Su bulutta azaltıldı. Yeni değer:", nextWaterValue);
      } else {
        console.log("❌ Su azaltılırken DB hatası:", error.message);
      }
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Üst Karşılama Satırı */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Merhaba,</Text>
            <Text style={styles.username}>{displayName} 👋</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
            <Text style={styles.signOutText}>Çıkış</Text>
          </TouchableOpacity>
        </View>

        {/* Ana Kalori Özet Kartı */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Daily Calories</Text>
          <View style={styles.row}>
            {/* Target Alanı */}
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
                    // 🌟 MİSAFİR KİLİDİ: Misafir kalori hedefine basarsa düzenletme, uyar
                    if (isGuest) {
                      Alert.alert(
                        "Kısıtlı Alan 🔒",
                        "Kalori hedefi belirlemek ve günlük diyet takibi yapmak için lütfen ücretsiz bir hesap oluşturun.",
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

            {/* Eaten Alanı */}
            <View style={styles.metricBlock}>
              <Text style={styles.metricValue}>{totals.calories}</Text>
              <Text style={styles.metricLabel}>Eaten</Text>
            </View>

            <Text style={styles.operator}>=</Text>

            {/* Remaining Alanı */}
            <View
              style={[
                styles.metricBlock,
                { backgroundColor: "#E8F5E9", borderRadius: 12, padding: 6 },
              ]}
            >
              <Text style={[styles.metricValue, { color: "#2E7D32" }]}>
                {remainingCalories < 0 ? 0 : remainingCalories}
              </Text>
              <Text style={styles.metricLabel}>Remaining</Text>
            </View>
          </View>
        </View>

        {/* Makro Kartları */}
        <Text style={styles.sectionTitle}>Macros Breakdown</Text>
        <View style={styles.macroRow}>
          <View style={[styles.macroCard, { borderTopColor: "#2b6cb0" }]}>
            <Text style={styles.macroValue}>{totals.protein}g</Text>
            <Text style={styles.macroLabel}>Protein</Text>
          </View>
          <View style={[styles.macroCard, { borderTopColor: "#6b46c1" }]}>
            <Text style={styles.macroValue}>{totals.carbs}g</Text>
            <Text style={styles.macroLabel}>Carbs</Text>
          </View>
          <View style={[styles.macroCard, { borderTopColor: "#ed64a6" }]}>
            <Text style={styles.macroValue}>{totals.fat}g</Text>
            <Text style={styles.macroLabel}>Fat</Text>
          </View>
        </View>

        {/* Su Takip Kartı */}
        {/* Su Takip Kartı */}
        <View style={[styles.waterCard, isGuest && styles.disabledElement]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.waterTitle}>Water Log 💧</Text>
            <Text style={styles.waterProgress}>
              {/* 🌟 Eğik çizgi ve hedef kalktı, sadece saf miktar ve tebrik emojisi var */}
              {waterIntake} {waterIntake === 1 ? "Glass" : "Glasses"}{" "}
              {waterIntake >= 8 ? "" : ""}
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
      </ScrollView>

      {/* Akıllı + FAB Butonu */}
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
  signOutBtn: {
    backgroundColor: "#fee2e2",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  signOutText: { color: "#ef4444", fontWeight: "600", fontSize: 13 },
  summaryCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
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
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  metricBlock: { alignItems: "center", minWidth: 75 },
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
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
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
  },
  waterTitle: { fontSize: 16, fontWeight: "bold", color: "#1565C0" },
  waterProgress: { fontSize: 14, color: "#1E88E5", marginTop: 4 },
  waterActionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  waterMinusButton: {
    backgroundColor: "#ef4444", // Kırmızı azaltma butonu
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  waterAddButton: {
    backgroundColor: "#1976D2", // Mavi ekleme butonu
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  waterButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  fabIcon: { color: "#FFF", fontSize: 36, fontWeight: "300", marginTop: -2 },

  // 🌟 MİSAFİR MODU İÇİN ÖZEL SİLİK GÖRÜNÜM STİLİ
  disabledElement: {
    opacity: 0.4,
  },
});
