/**
 * 공통 입력 필드 컴포넌트
 */
import React, { useState, forwardRef } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, TextStyle } from 'react-native';
import { Colors } from '../constants/Colors';

export interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  editable?: boolean;
  rightElement?: React.ReactNode;
  maxLength?: number;
  returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
  onSubmitEditing?: () => void;
  inputStyle?: TextStyle;
}

export const Input = forwardRef<TextInput, InputProps>(({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  editable = true,
  rightElement,
  maxLength,
  returnKeyType = 'next',
  onSubmitEditing,
  inputStyle,
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputContainer}>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            error && styles.inputError,
            !editable && styles.inputDisabled,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textLight}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={editable}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeIconText}>{showPassword ? '숨김' : '표시'}</Text>
          </TouchableOpacity>
        )}
        {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text,
    minHeight: 54,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputDisabled: {
    backgroundColor: Colors.backgroundGray,
    color: Colors.textDisabled,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  eyeIconText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  rightElement: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
});
