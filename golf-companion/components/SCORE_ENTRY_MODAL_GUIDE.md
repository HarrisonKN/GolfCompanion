# ScoreEntryModal Usage Guide

## Overview

The `ScoreEntryModal` is a reusable component for entering golf scores and putts. It's fully extracted and can be used anywhere in your Golf Companion app.

## Location

```
golf-companion/components/ScoreEntryModal.tsx
```

## Features

- ✅ **Theme-aware**: Automatically uses your app's theme from `ThemeContext`
- ✅ **Configurable bounds**: Set min/max values for scores and putts
- ✅ **Context display**: Optionally show player name and hole information
- ✅ **Button states**: Disabled states when reaching min/max values
- ✅ **Auto-reset**: Automatically resets to provided values when opened
- ✅ **Fully typed**: Complete TypeScript support

## Basic Usage

```tsx
import ScoreEntryModal from '@/components/ScoreEntryModal';
import { useState } from 'react';

function MyComponent() {
  const [modalVisible, setModalVisible] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentPutts, setCurrentPutts] = useState(0);

  return (
    <>
      <TouchableOpacity onPress={() => setModalVisible(true)}>
        <Text>Enter Score</Text>
      </TouchableOpacity>

      <ScoreEntryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        score={currentScore}
        putts={currentPutts}
        onSave={(score, putts) => {
          setCurrentScore(score);
          setCurrentPutts(putts);
          console.log(`Saved: ${score}/${putts}`);
        }}
      />
    </>
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `visible` | `boolean` | ✅ | - | Controls modal visibility |
| `onClose` | `() => void` | ✅ | - | Called when modal should close |
| `score` | `number` | ✅ | - | Initial score value |
| `putts` | `number` | ✅ | - | Initial putts value |
| `onSave` | `(score: number, putts: number) => void` | ✅ | - | Called when user saves |
| `playerIndex` | `number \| null` | ❌ | - | Optional player index (for reference) |
| `holeIndex` | `number \| null` | ❌ | - | Optional hole index (for reference) |
| `playerName` | `string` | ❌ | - | Display player name in modal |
| `holeName` | `string` | ❌ | - | Display hole info in modal |
| `maxScore` | `number` | ❌ | 15 | Maximum allowed score |
| `minScore` | `number` | ❌ | 0 | Minimum allowed score |
| `maxPutts` | `number` | ❌ | 10 | Maximum allowed putts |
| `minPutts` | `number` | ❌ | 0 | Minimum allowed putts |

## Advanced Usage Examples

### With Player and Hole Context

```tsx
<ScoreEntryModal
  visible={modalVisible}
  onClose={() => setModalVisible(false)}
  score={4}
  putts={2}
  onSave={(score, putts) => {
    // Save logic
  }}
  playerName="John Doe"
  holeName="Hole 5 - Par 4"
/>
```

### With Custom Bounds

```tsx
<ScoreEntryModal
  visible={modalVisible}
  onClose={() => setModalVisible(false)}
  score={3}
  putts={1}
  onSave={(score, putts) => {
    // Save logic
  }}
  minScore={1}
  maxScore={10}
  maxPutts={5}
/>
```

### Integration with State Management

```tsx
function ScorecardComponent() {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    playerIndex: number;
    holeIndex: number;
  } | null>(null);
  const [players, setPlayers] = useState([...]);

  const openScoreModal = (playerIndex: number, holeIndex: number) => {
    setSelectedCell({ playerIndex, holeIndex });
    setModalVisible(true);
  };

  const handleSave = (score: number, putts: number) => {
    if (!selectedCell) return;
    
    // Update your state
    const updatedPlayers = [...players];
    updatedPlayers[selectedCell.playerIndex].scores[selectedCell.holeIndex] = 
      `${score}/${putts}`;
    setPlayers(updatedPlayers);

    // Persist to database
    await saveToSupabase(score, putts);
  };

  return (
    <>
      {/* Your scorecard UI */}
      
      <ScoreEntryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        score={getCurrentScore(selectedCell)}
        putts={getCurrentPutts(selectedCell)}
        onSave={handleSave}
        playerName={getCurrentPlayerName(selectedCell)}
        holeName={getCurrentHoleName(selectedCell)}
      />
    </>
  );
}
```

### With Async Save Operations

```tsx
<ScoreEntryModal
  visible={modalVisible}
  onClose={() => setModalVisible(false)}
  score={currentScore}
  putts={currentPutts}
  onSave={async (score, putts) => {
    try {
      // Show loading state if needed
      await supabase
        .from('scores')
        .upsert({
          player_id: playerId,
          hole_number: holeNumber,
          score: score,
          putts: putts,
        });
      
      // Update local state
      updateLocalState(score, putts);
      
      // Show success message
      Alert.alert('Success', 'Score saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save score');
    }
  }}
/>
```

## Usage in Different Screens

### Tournament Screen

```tsx
import ScoreEntryModal from '@/components/ScoreEntryModal';

export default function TournamentScreen() {
  // ... your tournament logic
  
  return (
    <ScoreEntryModal
      visible={scoreModalOpen}
      onClose={() => setScoreModalOpen(false)}
      score={selectedScore}
      putts={selectedPutts}
      onSave={handleTournamentScoreSave}
      playerName={selectedPlayer?.name}
      holeName={`Round ${currentRound} - Hole ${currentHole}`}
    />
  );
}
```

### Practice Round Screen

```tsx
import ScoreEntryModal from '@/components/ScoreEntryModal';

export default function PracticeRoundScreen() {
  return (
    <ScoreEntryModal
      visible={visible}
      onClose={onClose}
      score={score}
      putts={putts}
      onSave={(score, putts) => {
        // Save to local storage or practice database
        savePracticeScore(score, putts);
      }}
      holeName={`Practice - Hole ${holeNumber}`}
    />
  );
}
```

### Statistics/History Screen

```tsx
import ScoreEntryModal from '@/components/ScoreEntryModal';

export default function EditHistoryScreen() {
  return (
    <ScoreEntryModal
      visible={editModalOpen}
      onClose={() => setEditModalOpen(false)}
      score={historicalScore}
      putts={historicalPutts}
      onSave={(score, putts) => {
        // Update historical data
        updateHistoricalScore(roundId, holeNumber, score, putts);
      }}
      playerName={playerName}
      holeName={`${courseName} - Hole ${holeNumber} - ${date}`}
    />
  );
}
```

## Styling

The modal automatically adapts to your theme. It uses the following palette properties:

- `palette.cardBackground` - Modal background color
- `palette.textLight` - Primary text color
- `palette.textMuted` - Secondary text (context info)
- `palette.textDark` - Button text color
- `palette.primary` - Plus/minus button color
- `palette.disabled` - Disabled button color
- `palette.secondary` - Cancel button color
- `palette.success` - Save button color

## Current Implementation

The modal is already being used in `scorecard.tsx`:

```tsx
<ScoreEntryModal
  visible={scoreModalVisible}
  onClose={() => setScoreModalVisible(false)}
  score={selectedParsed.score}
  putts={selectedParsed.putts}
  onSave={async (score, putts) => {
    // Handle team and player scoring logic
    // ...
  }}
/>
```

## Tips

1. **Always provide initial values**: The modal needs `score` and `putts` props to initialize properly
2. **Handle async operations**: The `onSave` callback can be async
3. **Close after save**: The modal automatically closes after save, but you can control this with `onClose`
4. **Validation**: Add your own validation in the `onSave` callback if needed
5. **Error handling**: Wrap save operations in try-catch blocks

## Accessibility

The modal includes:
- Proper touch targets (36x36 minimum)
- Clear visual feedback for disabled states
- Keyboard-friendly (modal can be closed with back button on Android)
- Semantic button labels

## Future Enhancements

Potential improvements you could add:

- Keyboard input option
- Custom increment values (e.g., +2, -2)
- Undo/redo functionality
- Sound effects on button press
- Haptic feedback
- Quick presets (par, birdie, bogey)
- Statistics display (average, best, etc.)

## Questions?

If you need help integrating this modal into other parts of your app, refer to the existing implementation in `scorecard.tsx` or check the examples above.
