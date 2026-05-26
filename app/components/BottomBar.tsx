import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface BottomBarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

const BottomBar: React.FC<BottomBarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <View style={styles.container}>
      {/* HOME */}
      <TouchableOpacity style={styles.tab} onPress={() => setActiveTab("home")}>
        <Text style={[styles.icon, activeTab === "home" && styles.activeIcon]}>
          🏠
        </Text>
        <Text
          style={[styles.label, activeTab === "home" && styles.activeLabel]}
        >
          Home
        </Text>
      </TouchableOpacity>

      {/* PROGRESS / HISTORY */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => setActiveTab("history")}
      >
        <Text
          style={[styles.icon, activeTab === "history" && styles.activeIcon]}
        >
          📈
        </Text>
        <Text
          style={[styles.label, activeTab === "history" && styles.activeLabel]}
        >
          Progress
        </Text>
      </TouchableOpacity>

      {/* PROFILE */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => setActiveTab("profile")}
      >
        <Text
          style={[styles.icon, activeTab === "profile" && styles.activeIcon]}
        >
          👤
        </Text>
        <Text
          style={[styles.label, activeTab === "profile" && styles.activeLabel]}
        >
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    height: 75,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    position: "absolute",
    bottom: 0,
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 10,
    // Premium Gölge
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  tab: { alignItems: "center", justifyContent: "center", flex: 1 },
  icon: { fontSize: 22, opacity: 0.3 },
  activeIcon: { opacity: 1 },
  label: { fontSize: 11, fontWeight: "600", color: "#94a3b8", marginTop: 4 },
  activeLabel: { color: "#2E7D32", fontWeight: "bold" },
});

export default BottomBar;
