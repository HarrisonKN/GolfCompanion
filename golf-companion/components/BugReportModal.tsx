import React, { useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/components/ThemeContext';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/components/supabase';
import { MaterialIcons } from '@expo/vector-icons';

interface BugReportModalProps {
  visible: boolean;
  onClose: () => void;
}

const { height: screenHeight } = Dimensions.get('window');

export default function BugReportModal({ visible, onClose }: BugReportModalProps) {
  const { palette } = useTheme();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [severity, setSeverity] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { value: 'ui', label: 'UI Issue', icon: 'design-services' },
    { value: 'crash', label: 'App Crash', icon: 'error' },
    { value: 'performance', label: 'Performance', icon: 'speed' },
    { value: 'feature', label: 'Feature Request', icon: 'lightbulb' },
    { value: 'other', label: 'Other', icon: 'help' },
  ];

  const severities = [
    { value: 'low', label: 'Low', color: '#10B981' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high', label: 'High', color: '#EF4444' },
    { value: 'critical', label: 'Critical', color: '#DC2626' },
  ];

  const submitBugReport = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simple device info without expo-device
      const deviceInfo = {
        platform: Platform.OS,
        platformVersion: Platform.Version.toString(),
        timestamp: new Date().toISOString(),
      };

      const { error } = await supabase.from('bug_reports').insert({
        user_id: user?.id,
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        device_info: deviceInfo,
        app_version: '1.0.0',
        os_version: Platform.Version.toString(),
      });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      Alert.alert(
        'Success',
        'Thank you for your feedback! We\'ll review your report.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (error) {
      console.error('Error submitting bug report:', error);
      Alert.alert('Error', 'Failed to submit bug report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setCategory('other');
    setSeverity('medium');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles(palette).overlay}>
        <View style={styles(palette).container}>
          <View style={styles(palette).header}>
            <ThemedText style={styles(palette).title}>Report Bug</ThemedText>
            <Pressable onPress={handleClose} style={styles(palette).closeButton}>
              <MaterialIcons name="close" size={24} color={palette.textDark} />
            </Pressable>
          </View>

          <ScrollView style={styles(palette).content} showsVerticalScrollIndicator={false}>
            <View style={styles(palette).inputGroup}>
              <ThemedText style={styles(palette).label}>Title *</ThemedText>
              <TextInput
                style={styles(palette).input}
                value={title}
                onChangeText={setTitle}
                placeholder="Brief description of the issue"
                placeholderTextColor={palette.textLight}
                maxLength={100}
              />
              <ThemedText style={styles(palette).helperText}>
                {title.length}/100 characters
              </ThemedText>
            </View>

            <View style={styles(palette).inputGroup}>
              <ThemedText style={styles(palette).label}>Description *</ThemedText>
              <TextInput
                style={[styles(palette).input, styles(palette).textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Please describe the issue in detail. Include steps to reproduce if possible."
                placeholderTextColor={palette.textLight}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <ThemedText style={styles(palette).helperText}>
                {description.length}/500 characters
              </ThemedText>
            </View>

            <View style={styles(palette).inputGroup}>
              <ThemedText style={styles(palette).label}>Category</ThemedText>
              <View style={styles(palette).categoryGrid}>
                {categories.map((cat) => (
                  <Pressable
                    key={cat.value}
                    style={[
                      styles(palette).categoryButton,
                      category === cat.value && styles(palette).categoryButtonSelected,
                    ]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <MaterialIcons
                      name={cat.icon as any}
                      size={18}
                      color={category === cat.value ? palette.white : palette.textDark}
                    />
                    <ThemedText
                      style={[
                        styles(palette).categoryText,
                        category === cat.value && { color: palette.white },
                      ]}
                    >
                      {cat.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles(palette).inputGroup}>
              <ThemedText style={styles(palette).label}>Severity</ThemedText>
              <View style={styles(palette).severityContainer}>
                {severities.map((sev) => (
                  <Pressable
                    key={sev.value}
                    style={[
                      styles(palette).severityButton,
                      severity === sev.value && { backgroundColor: sev.color },
                    ]}
                    onPress={() => setSeverity(sev.value)}
                  >
                    <ThemedText
                      style={[
                        styles(palette).severityText,
                        severity === sev.value && { color: palette.white },
                      ]}
                    >
                      {sev.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Device Info Section */}
            <View style={styles(palette).deviceInfoContainer}>
              <ThemedText style={styles(palette).deviceInfoTitle}>
                📱 Device Information (automatically included)
              </ThemedText>
              <ThemedText style={styles(palette).deviceInfoText}>
                Platform: {Platform.OS} {Platform.Version}
              </ThemedText>
              <ThemedText style={styles(palette).deviceInfoText}>
                App Version: 1.0.0
              </ThemedText>
            </View>
          </ScrollView>

          <View style={styles(palette).footer}>
            <Pressable
              style={[
                styles(palette).submitButton,
                (!title.trim() || !description.trim() || isSubmitting) &&
                  styles(palette).submitButtonDisabled,
              ]}
              onPress={submitBugReport}
              disabled={!title.trim() || !description.trim() || isSubmitting}
            >
              <ThemedText style={styles(palette).submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = (palette: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40, // Add padding to prevent touching screen edges
  },
  container: {
    backgroundColor: palette.white,
    width: '95%', // Increased width
    height: screenHeight * 0.85, // Take up 85% of screen height
    borderRadius: 20,
    elevation: 5,
    shadowColor: palette.black,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24, // Increased padding
    borderBottomWidth: 1,
    borderBottomColor: palette.grey,
  },
  title: {
    fontSize: 22, // Larger title
    fontWeight: '700',
    color: palette.primary,
  },
  closeButton: {
    padding: 8, // Larger touch target
    borderRadius: 12,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
    padding: 24, // Increased padding
  },
  inputGroup: {
    marginBottom: 24, // Increased spacing
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textDark,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.grey,
    borderRadius: 12,
    padding: 16, // Increased padding
    fontSize: 16,
    color: palette.textDark,
    backgroundColor: palette.background,
    minHeight: 50, // Minimum height for better UX
  },
  textArea: {
    height: 120, // Larger text area
  },
  helperText: {
    fontSize: 12,
    color: palette.textLight,
    marginTop: 6,
    textAlign: 'right',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10, // Increased gap
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.background,
    paddingHorizontal: 14, // Increased padding
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.grey,
    gap: 6,
    minWidth: 120, // Ensure consistent button sizes
  },
  categoryButtonSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  categoryText: {
    fontSize: 14, // Larger text
    color: palette.textDark,
    fontWeight: '500',
  },
  severityContainer: {
    flexDirection: 'row',
    gap: 10, // Increased gap
  },
  severityButton: {
    flex: 1,
    backgroundColor: palette.background,
    paddingVertical: 14, // Increased padding
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.grey,
  },
  severityText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textDark,
  },
  deviceInfoContainer: {
    backgroundColor: palette.background,
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: palette.grey,
  },
  deviceInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textDark,
    marginBottom: 8,
  },
  deviceInfoText: {
    fontSize: 12,
    color: palette.textLight,
    marginBottom: 4,
  },
  footer: {
    padding: 24, // Increased padding
    borderTopWidth: 1,
    borderTopColor: palette.grey,
  },
  submitButton: {
    backgroundColor: palette.primary,
    paddingVertical: 18, // Larger button
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: palette.primary,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  submitButtonDisabled: {
    backgroundColor: palette.grey,
    elevation: 0,
    shadowOpacity: 0,
  },
  submitButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
});