import { supabase } from "@/lib/supabase"; // Supabase bağlantınız
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface WelcomeProps {
  onStart: (session: any) => void;
  onGuest: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onStart, onGuest }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Giriş mi, kayıt modu mu?

  const handleAuth = async () => {
    if (!email || !password) {
      return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
    }

    setAuthLoading(true);

    if (isSignUp) {
      // 📝 1. ADIM: HESAP OLUŞTURMA
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        Alert.alert("Kayıt Başarısız", error.message);
        setAuthLoading(false);
        return;
      }

      // Arka planda açılan o otomatik oturumu hemen iptal ediyoruz
      await supabase.auth.signOut();

      // Kullanıcıya tertemiz uyarıyı gösteriyoruz
      Alert.alert(
        "Kayıt Başarılı! 🎉",
        "Hesabınız oluşturuldu. Lütfen az önce belirlediğiniz e-posta ve şifre ile giriş yapın.",
      );

      // Formu temizle ve Giriş moduna çek
      setPassword("");
      setIsSignUp(false);
    } else {
      // 🔐 2. ADIM: GERÇEK GİRİŞ YAPMA AKIŞI
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert("Giriş Başarısız", error.message);
      } else if (data?.session) {
        // Burası tetiklendiğinde App.tsx içindeki onStart fonksiyonu currentScreen'i "home" yapacak!
        onStart(data.session);
      }
    }
    setAuthLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Üst Logo ve Başlık Alanı */}
          <View style={styles.headerArea}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🥗</Text>
            </View>
            <Text style={styles.title}>DeepDiet</Text>
            <Text style={styles.subtitle}>AI-Powered Nutrition Assistant</Text>
          </View>

          {/* Form Alanı Kartı */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {isSignUp ? "Yeni Hesap Oluştur" : "Uygulamaya Giriş Yap"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="E-posta Adresi"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Şifre"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {authLoading ? (
              <ActivityIndicator
                size="large"
                color="#2E7D32"
                style={{ marginVertical: 20 }}
              />
            ) : (
              <>
                {/* ANA AKSİYON BUTONU (Soft Sağlık Yeşili) */}
                <TouchableOpacity style={styles.button} onPress={handleAuth}>
                  <Text style={styles.buttonText}>
                    {isSignUp ? "Hesap Oluştur ve Kaydol" : "Giriş Yap"}
                  </Text>
                </TouchableOpacity>

                {/* GİRİŞ / KAYIT MODU DEĞİŞTİRİCİSİ */}
                <TouchableOpacity
                  onPress={() => setIsSignUp(!isSignUp)}
                  style={styles.toggleModeButton}
                >
                  <Text style={styles.toggleModeText}>
                    {isSignUp
                      ? "Zaten bir hesabın var mı? Giriş Yap"
                      : "Hesabın yok mu? Yeni Kayıt Oluştur"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* MİSAFİR MODU KÖPRÜSÜ */}
          <TouchableOpacity style={styles.guestButton} onPress={onGuest}>
            <Text style={styles.guestText}>Misafir Olarak Devam Et</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F4" }, // Yeni tasarımdaki gibi soft gri/yeşil arka plan
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  headerArea: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 90,
    height: 90,
    backgroundColor: "#FFF",
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    // Soft gölge efektleri (Tasarımındaki kartlar gibi)
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  logoEmoji: { fontSize: 38 },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#2E7D32", // Yeni Ana Tema Yeşili
    letterSpacing: 0.5,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 15,
    textAlign: "center",
    marginTop: 4,
  },
  formCard: {
    backgroundColor: "#FFF",
    width: "100%",
    padding: 24,
    borderRadius: 24,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#F8FAFC",
    width: "100%",
    padding: 16,
    borderRadius: 16,
    color: "#1e293b",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 15,
  },
  button: {
    backgroundColor: "#2E7D32", // Dashboard FAB ile uyumlu koyu yeşil tonu
    width: "100%",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
    elevation: 2,
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  toggleModeButton: {
    marginTop: 16,
    alignItems: "center",
  },
  toggleModeText: {
    color: "#2E7D32",
    fontWeight: "600",
    fontSize: 14,
  },
  guestButton: {
    marginTop: 10,
    paddingVertical: 8,
  },
  guestText: {
    color: "#64748b",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});

export default Welcome;
