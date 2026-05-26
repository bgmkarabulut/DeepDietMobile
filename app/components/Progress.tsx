import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ProgressScreen({ session }: any) {
  const [loading, setLoading] = useState(true);
  const [weeklyLogs, setWeeklyLogs] = useState<any[]>([]);
  const [mealHistory, setMealHistory] = useState<any[]>([]);

  // Yerel saate göre YYYY-MM-DD formatında tarih üreten fonksiyon (Gün kaymasını önler)
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

      // 1. Son 7 Günün Su ve Kalori Hedefi Verilerini Çek
      const startDateStr = getLocalDateOffsetString(7);

      const { data: logs, error: logsError } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("date", startDateStr)
        .order("date", { ascending: false });

      if (!logsError && logs) {
        setWeeklyLogs(logs);
      } else if (logsError) {
        console.log("⚠️ daily_logs çekme hatası:", logsError.message);
      }

      // 2. Son Analiz Edilen Yemeklerin Geçmişini Çek (analysis_history)
      const { data: history, error: historyError } = await supabase
        .from("analysis_history")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(15);

      if (!historyError && history) {
        setMealHistory(history);
      } else if (historyError) {
        console.log("⚠️ analysis_history çekme hatası:", historyError.message);
      }
    } catch (error) {
      console.error("Progress verileri çekilirken genel hata:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProgressData();
    }, [session]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  // Tarih formatlama yardımcı fonksiyonu (Örn: 24 May)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 110 }}
    >
      {/* Üst Başlık Alanı */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress & History 📈</Text>
        <Text style={styles.headerSub}>
          Track your dietary journey over time
        </Text>
      </View>

      {/* 📊 BÖLÜM 1: HAFTALIK GÜNLÜK ÖZET (Daily Logs Summary) */}
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
          weeklyLogs.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <Text style={styles.logDate}>{formatDate(log.date)}</Text>
              <View style={styles.divider} />

              <Text style={styles.statLabel}>Water Target</Text>
              <Text style={styles.statValue}>{log.water_intake} Glasses</Text>

              <Text style={[styles.statLabel, { marginTop: 8 }]}>
                Calorie Budget
              </Text>
              <Text style={[styles.statValue, { color: "#2E7D32" }]}>
                🎯 {log.calorie_target} kcal
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* 🥗 BÖLÜM 2: ANALİZ EDİLEN YEMEKLERİN GEÇMİŞİ (Analysis History) */}
      <Text style={styles.sectionTitle}>Recent Meals Logged</Text>
      <View style={styles.historyListContainer}>
        {mealHistory.length === 0 ? (
          <View style={styles.emptyCardFull}>
            <Text style={styles.emptyText}>
              You haven't scanned any meals yet.
            </Text>
          </View>
        ) : (
          mealHistory.map((meal) => (
            <View key={meal.id} style={styles.mealCard}>
              <View style={styles.mealHeaderRow}>
                <Text style={styles.mealName}>
                  🍲{" "}
                  {Array.isArray(meal.detections) && meal.detections[0]
                    ? meal.detections[0].label
                    : "Analyzed Meal"}
                </Text>
                <Text style={styles.mealCalorie}>
                  {meal.total_calories} kcal
                </Text>
              </View>

              {/* 🌟 SAAT DİLİMİ TÜRKİYE'YE ZORLANAN YENİ ALAN */}
              <Text style={styles.mealTime}>
                Logged at:{" "}
                {(() => {
                  try {
                    // 1. Eğer gelen veri geçersiz veya boşsa direkt boş dön
                    if (!meal.created_at) return "00:00";

                    // 2. Metnin içindeki saat kısmını bulalım (Örn: "20:34:00" veya "T20:34:00")
                    // Her ihtimale karşı metindeki saat-dakika kalıbını regex ile cımbızlıyoruz
                    const timeMatch = meal.created_at.match(/(\d{2}):(\d{2})/);

                    if (timeMatch) {
                      const dbHour = parseInt(timeMatch[1], 10);
                      const dbMinute = timeMatch[2]; // Dakikayı string olarak tutalım, başında 0 olabilir

                      // 3. Supabase UTC (20) gönderdiği için Türkiye saati (+3) ekliyoruz
                      let localHour = dbHour + 3;

                      // Eğer saat 24'ü geçerse ertesi güne taşacağı için modu alıyoruz
                      if (localHour >= 24) {
                        localHour = localHour - 24;
                      }

                      // Saatin başına gerekirse sıfır ekleyelim (Örn: 9 -> "09")
                      const formattedHour = String(localHour).padStart(2, "0");

                      return `${formattedHour}:${dbMinute}`;
                    }

                    return "00:00";
                  } catch (e) {
                    return "00:00";
                  }
                })()}{" "}
                - {formatDate(meal.created_at)}
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
    marginTop: 20,
    marginBottom: 12,
  },
  insightsScroll: { paddingLeft: 24, paddingRight: 12 },
  logCard: {
    backgroundColor: "#FFF",
    width: 160,
    padding: 16,
    borderRadius: 20,
    marginRight: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
  },
  logDate: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
    textAlign: "center",
  },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 10 },
  statLabel: { fontSize: 11, color: "#94a3b8", fontWeight: "500" },
  statValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#334155",
    marginTop: 2,
  },
  historyListContainer: { paddingHorizontal: 24 },
  mealCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.01,
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
