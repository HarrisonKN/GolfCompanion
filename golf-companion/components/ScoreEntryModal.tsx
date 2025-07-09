import React, { Dispatch, SetStateAction, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";


interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (score: number, putts: number) => void;
}

export default function ScoreEntryModal({ visible, onClose, onSave }: Props) {
  const [score, setScore] = useState(0);
  const [putts, setPutts] = useState(0);

  const increment = (
  value: number,
  setter: Dispatch<SetStateAction<number>>
    ) => () => {
    setter((prev) => Math.max(0, prev + value));
    };

  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Enter Score & Putts</Text>

          <View style={styles.counterRow}>
            <Text style={styles.label}>Score</Text>
            <View style={styles.counter}>
              <TouchableOpacity onPress={increment(-1, setScore)} style={styles.button}>
                <Text style={styles.buttonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.value}>{score}</Text>
              <TouchableOpacity onPress={increment(1, setScore)} style={styles.button}>
                <Text style={styles.buttonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.counterRow}>
            <Text style={styles.label}>Putts</Text>
            <View style={styles.counter}>
              <TouchableOpacity onPress={increment(-1, setPutts)} style={styles.button}>
                <Text style={styles.buttonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.value}>{putts}</Text>
              <TouchableOpacity onPress={increment(1, setPutts)} style={styles.button}>
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
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
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
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  cancel: {
    marginRight: 16,
  },
  cancelText: {
    color: "#888",
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
