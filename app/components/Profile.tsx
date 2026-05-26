import { supabase } from "@/lib/supabase";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfileScreen({ session, onSignOut, isGuest }: any) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Düzenleme modları için state'ler
  const [isEditingStats, setIsEditingStats] = useState(false);
  const [inputs, setInputs] = useState({
    weight: "74.6",
    goal_weight: "70.0",
    height: "175",
    age: "28",
  });

  useEffect(() => {
    // 🌟 GÜVENLİK DUVARI 1: Eğer misafir ise veya session null ise veritabanına sorgu atma
    if (isGuest || !session?.user) {
      setLoading(false);
      return;
    }
    fetchProfile();
  }, [session, isGuest]);

  const fetchProfile = async () => {
    // 🌟 GÜVENLİK DUVARI 2: İhtiyaten fonksiyon içinde de session kontrolü
    if (!session?.user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (!error && data) {
        setProfile(data);
        setInputs({
          weight: String(data.weight ?? "74.6"),
          goal_weight: String(data.goal_weight ?? "70.0"),
          height: String(data.height ?? "175"),
          age: String(data.age ?? "28"),
        });
      }
    } catch (err) {
      console.error("Profil çekilirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  // VERİTABANINA MANUEL GİRİŞİ KAYDETME FONKSİYONU
  const handleSaveProfile = async () => {
    // 🌟 GÜVENLİK DUVARI 3: Misafir koruması
    if (isGuest || !session?.user) {
      Alert.alert(
        "Misafir Modu",
        "Profil bilgilerinizi kaydetmek için lütfen hesap oluşturun.",
      );
      return;
    }

    const numWeight = parseFloat(inputs.weight);
    const numGoalWeight = parseFloat(inputs.goal_weight);
    const numHeight = parseInt(inputs.height, 10);
    const numAge = parseInt(inputs.age, 10);

    if (
      isNaN(numWeight) ||
      isNaN(numGoalWeight) ||
      isNaN(numHeight) ||
      isNaN(numAge)
    ) {
      Alert.alert("Hata", "Lütfen tüm alanları geçerli sayılarla doldurun.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("users")
        .update({
          weight: numWeight,
          goal_weight: numGoalWeight,
          height: numHeight,
          age: numAge,
        })
        .eq("id", session.user.id);

      if (!error) {
        Alert.alert("Başarılı 🎉", "Profil bilgileriniz güncellendi.");
        setIsEditingStats(false);
        fetchProfile();
      } else {
        Alert.alert("Hata", "Veritabanına kaydedilirken bir sorun oluştu.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 🌟 GÜVENLİK DUVARI 4: Sign out basıldığı an veya yükleme anında session yoksa çökme, yükleniyor göster
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  // Eğer çıkış butonuna basıldıysa ve component unmount olma aşamasındaysa alt render kodlarını çalıştırma
  if (!isGuest && !session?.user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  // Değerleri güvenle fallback'e çekiyoruz
  const currentWeight = isGuest ? 74.6 : (profile?.weight ?? 74.6);
  const goalWeight = isGuest ? 70.0 : (profile?.goal_weight ?? 70.0);
  const toGo = (currentWeight - goalWeight).toFixed(1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 110 }}
    >
      {/* Üst Mavi Header Alanı */}
      <View style={styles.headerBackground}>
        <View style={styles.profileImageContainer}>
          <Text style={{ fontSize: 40 }}>🥗</Text>
        </View>
        <Text style={styles.name}>
          {isGuest
            ? "Misafir Kullanıcı"
            : profile?.full_name || "DeepDiet User"}
        </Text>
        <Text style={styles.email}>
          {isGuest ? "guest@deepdiet.com" : session.user.email}
        </Text>
      </View>

      {/* Düzenleme Paneli Butonu */}
      <View style={styles.editActionRow}>
        <Text style={styles.sectionTitle}>Body Metrics</Text>
        <TouchableOpacity
          style={styles.editToggleBtn}
          onPress={() => setIsEditingStats(!isEditingStats)}
        >
          <Text style={styles.editToggleText}>
            {isEditingStats ? "Cancel ❌" : "Edit Metrics ⚙️"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* FORM VE GÖSTERİM KATMANI */}
      {isEditingStats ? (
        <View style={styles.formCardContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Weight (kg)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={inputs.weight}
              onChangeText={(text) =>
                setInputs((prev) => ({ ...prev, weight: text }))
              }
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Goal Weight (kg)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={inputs.goal_weight}
              onChangeText={(text) =>
                setInputs((prev) => ({ ...prev, goal_weight: text }))
              }
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Height (cm)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={inputs.height}
              onChangeText={(text) =>
                setInputs((prev) => ({ ...prev, height: text }))
              }
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={inputs.age}
              onChangeText={(text) =>
                setInputs((prev) => ({ ...prev, age: text }))
              }
            />
          </View>

          <TouchableOpacity
            style={styles.saveProfileBtn}
            onPress={handleSaveProfile}
          >
            <Text style={styles.saveProfileBtnText}>Save Changes ✓</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* İstatistik Kartları Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Current Weight</Text>
              <Text style={styles.statValue}>{currentWeight} kg</Text>
              <Text style={styles.statSubText}>Active Tracking</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Goal Weight</Text>
              <Text style={styles.statValue}>{goalWeight} kg</Text>
              <Text style={styles.statSubText}>
                {parseFloat(toGo) > 0 ? `${toGo} kg to go` : "Goal reached! 🎉"}
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Height</Text>
              <Text style={styles.statValue}>
                {isGuest ? "175" : (profile?.height ?? "175")} cm
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Age</Text>
              <Text style={styles.statValue}>
                {isGuest ? "28" : (profile?.age ?? "28")} years old
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Alt Aksiyon Listesi */}
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem} onPress={onSignOut}>
          <Text style={[styles.menuText, { color: "#ef4444" }]}>
            🚪 Sign Out
          </Text>
        </TouchableOpacity>
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
  headerBackground: {
    backgroundColor: "#3498db",
    height: 260,
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  profileImageContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  name: { fontSize: 22, fontWeight: "bold", color: "#FFF" },
  email: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 8 },
  premiumBadge: {
    backgroundColor: "#f1c40f",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
  },
  premiumText: { fontWeight: "bold", fontSize: 11, color: "#333" },
  editActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#1e293b" },
  editToggleBtn: {
    backgroundColor: "#FFF",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    elevation: 1,
  },
  editToggleText: { fontSize: 12, fontWeight: "600", color: "#2E7D32" },
  formCardContainer: {
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    marginTop: 14,
    padding: 20,
    borderRadius: 24,
    elevation: 2,
  },
  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
    fontWeight: "500",
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    color: "#1e293b",
    fontSize: 15,
    fontWeight: "600",
  },
  saveProfileBtn: {
    backgroundColor: "#2E7D32",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  saveProfileBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 14,
    justifyContent: "space-between",
  },
  statCard: {
    backgroundColor: "#FFF",
    width: "48%",
    padding: 16,
    borderRadius: 20,
    elevation: 1,
  },
  statLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  statSubText: {
    fontSize: 11,
    color: "#2E7D32",
    fontWeight: "600",
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 24,
    marginBottom: 14,
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 24,
    elevation: 1,
  },
  badgeItem: { alignItems: "center" },
  badgeNumber: { fontSize: 18, fontWeight: "bold", color: "#3498db" },
  badgeLabel: { fontSize: 11, color: "#64748b", marginTop: 4 },
  menuContainer: { paddingHorizontal: 20, marginTop: 10 },
  menuItem: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    elevation: 1,
  },
  menuText: { fontSize: 15, fontWeight: "600", color: "#334155" },
});
