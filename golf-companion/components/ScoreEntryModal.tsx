import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type ScoreEntryModalProps = {
  visible: boolean;
  onClose: () => void;
  score: number;
  putts: number;
  onScoreChange: (score: number) => void;
  onPuttsChange: (putts: number) => void;
  onSave: (score: number, putts: number) => void;
};

const ScoreEntryModal: React.FC<ScoreEntryModalProps> = ({
  visible,
  onClose,
  score,
  putts,
  onScoreChange,
  onPuttsChange,
  onSave,
}) => {
  const increment = (
    value: number,
    setter: (value: number) => void
  ) => () => {
    setter(Math.max(0, value));
  };

  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Enter Score & Putts</Text>

          <View style={styles.counterRow}>
            <Text style={styles.label}>Score</Text>
            <View style={styles.counter}>
              <TouchableOpacity
                onPress={increment(score - 1, onScoreChange)}
                style={styles.button}
              >
                <Text style={styles.buttonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.value}>{score}</Text>
              <TouchableOpacity
                onPress={increment(score + 1, onScoreChange)}
                style={styles.button}
              >
                <Text style={styles.buttonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.counterRow}>
            <Text style={styles.label}>Putts</Text>
            <View style={styles.counter}>
              <TouchableOpacity
                onPress={increment(putts - 1, onPuttsChange)}
                style={styles.button}
              >
                <Text style={styles.buttonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.value}>{putts}</Text>
              <TouchableOpacity
                onPress={increment(putts + 1, onPuttsChange)}
                style={styles.button}
              >
                <Text style={styles.buttonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onSave(score, putts);
                onClose();
              }}
              style={styles.save}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#1e1e1e",
    padding: 20,
    borderRadius: 12,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    width: "85%",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#fff",
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    color: "#fff",
  },
  counter: {
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 20,
  },
  value: {
    marginHorizontal: 16,
    fontSize: 18,
    color: "#fff",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  cancel: {
    marginRight: 16,
    backgroundColor: "#555",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelText: {
    color: "#fff",
  },
  save: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
  },
});

export default ScoreEntryModal;
