import React, { useState, useEffect } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "./ThemeContext";

type ScoreEntryModalProps = {
  visible: boolean;
  onClose: () => void;
  score: number;
  putts: number;
  onSave: (score: number, putts: number) => void;
  playerIndex?: number | null;
  holeIndex?: number | null;
  playerName?: string;
  holeName?: string;
  maxScore?: number;
  minScore?: number;
  maxPutts?: number;
  minPutts?: number;
};

/**
 * ScoreEntryModal - A reusable modal component for entering golf scores and putts
 * 
 * This component can be used anywhere in the app where score entry is needed.
 * 
 * Features:
 * - Theme-aware styling using ThemeContext
 * - Configurable min/max values for score and putts
 * - Optional display of player name and hole information
 * - Increment/decrement buttons with bounds checking
 * - Auto-resets to provided values when modal opens
 * 
 * @example
 * ```tsx
 * <ScoreEntryModal
 *   visible={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   score={currentScore}
 *   putts={currentPutts}
 *   onSave={(score, putts) => {
 *     // Handle save logic
 *     console.log(`Score: ${score}, Putts: ${putts}`);
 *   }}
 *   playerName="John Doe"
 *   holeName="Hole 5"
 *   minScore={1}
 *   maxScore={15}
 * />
 * ```
 */
const ScoreEntryModal: React.FC<ScoreEntryModalProps> = ({
  visible,
  onClose,
  score,
  putts,
  onSave,
  playerName,
  holeName,
  maxScore = 15,
  minScore = 0,
  maxPutts = 10,
  minPutts = 0,
}) => {
  const { palette } = useTheme();
  const [localScore, setLocalScore] = useState(score);
  const [localPutts, setLocalPutts] = useState(putts);

  useEffect(() => {
    if (visible) {
      setLocalScore(score ?? 0);
      setLocalPutts(putts ?? 0);
    }
  }, [visible, score, putts]);

  const handleScoreDecrement = () => {
    setLocalScore(Math.max(minScore, localScore - 1));
  };

  const handleScoreIncrement = () => {
    setLocalScore(Math.min(maxScore, localScore + 1));
  };

  const handlePuttsDecrement = () => {
    setLocalPutts(Math.max(minPutts, localPutts - 1));
  };

  const handlePuttsIncrement = () => {
    setLocalPutts(Math.min(maxPutts, localPutts + 1));
  };

  const handleSave = () => {
    onSave(localScore, localPutts);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles(palette).overlay}>
        <View style={styles(palette).container}>
          <Text style={styles(palette).title}>Enter Score & Putts</Text>
          
          {(playerName || holeName) && (
            <View style={styles(palette).contextInfo}>
              {playerName && <Text style={styles(palette).contextText}>{playerName}</Text>}
              {holeName && <Text style={styles(palette).contextText}>{holeName}</Text>}
            </View>
          )}

          <View style={styles(palette).counterRow}>
            <Text style={styles(palette).label}>Score</Text>
            <View style={styles(palette).counter}>
              <TouchableOpacity
                onPress={handleScoreDecrement}
                style={[
                  styles(palette).button,
                  localScore <= minScore && styles(palette).buttonDisabled
                ]}
                disabled={localScore <= minScore}
              >
                <Text style={styles(palette).buttonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles(palette).value}>{localScore}</Text>
              <TouchableOpacity
                onPress={handleScoreIncrement}
                style={[
                  styles(palette).button,
                  localScore >= maxScore && styles(palette).buttonDisabled
                ]}
                disabled={localScore >= maxScore}
              >
                <Text style={styles(palette).buttonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles(palette).counterRow}>
            <Text style={styles(palette).label}>Putts</Text>
            <View style={styles(palette).counter}>
              <TouchableOpacity
                onPress={handlePuttsDecrement}
                style={[
                  styles(palette).button,
                  localPutts <= minPutts && styles(palette).buttonDisabled
                ]}
                disabled={localPutts <= minPutts}
              >
                <Text style={styles(palette).buttonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles(palette).value}>{localPutts}</Text>
              <TouchableOpacity
                onPress={handlePuttsIncrement}
                style={[
                  styles(palette).button,
                  localPutts >= maxPutts && styles(palette).buttonDisabled
                ]}
                disabled={localPutts >= maxPutts}
              >
                <Text style={styles(palette).buttonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles(palette).actions}>
            <TouchableOpacity onPress={onClose} style={styles(palette).cancel}>
              <Text style={styles(palette).cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={styles(palette).save}>
              <Text style={styles(palette).saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = (palette: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: palette.cardBackground || "#1e1e1e",
    padding: 20,
    borderRadius: 12,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    width: "85%",
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: palette.textLight || "#fff",
  },
  contextInfo: {
    marginBottom: 12,
    alignItems: "center",
  },
  contextText: {
    fontSize: 14,
    color: palette.textMuted || "#aaa",
    marginBottom: 4,
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    color: palette.textLight || "#fff",
    fontWeight: "600",
  },
  counter: {
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.primary || "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: palette.disabled || "#555",
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: palette.textDark || "#000",
  },
  value: {
    marginHorizontal: 16,
    fontSize: 20,
    fontWeight: "bold",
    color: palette.textLight || "#fff",
    minWidth: 40,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  cancel: {
    marginRight: 16,
    backgroundColor: palette.secondary || "#555",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelText: {
    color: palette.textLight || "#fff",
  },
  save: {
    backgroundColor: palette.success || "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveText: {
    color: palette.textLight || "#fff",
    fontWeight: "bold",
  },
});

export default ScoreEntryModal;
