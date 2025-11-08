import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TodoItem } from '../api/todo';
import { Colors } from '../constants/Colors';
import { formatTimeKorean } from '../utils/dateUtils';

type AppUser = {
  user_id: string;
  name: string;
  role: string;
} | null;

interface ScheduleDetailModalProps {
  visible: boolean;
  schedule: TodoItem | null;
  user: AppUser;
  onClose: () => void;
  onEdit?: (schedule: TodoItem) => void;
  onDelete?: (schedule: TodoItem) => void;
  onComplete?: (schedule: TodoItem) => void;
  onCancelComplete?: (schedule: TodoItem) => void;
  canElderlyModifySchedule?: (schedule: TodoItem) => boolean;
  canCaregiverModifySchedule?: (schedule: TodoItem) => boolean;
}

export const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({
  visible,
  schedule,
  user,
  onClose,
  onEdit,
  onDelete,
  onComplete,
  onCancelComplete,
  canElderlyModifySchedule,
  canCaregiverModifySchedule,
}) => {
  const handleEdit = () => {
    if (schedule && onEdit) {
      onEdit(schedule);
    }
  };

  const handleDelete = () => {
    if (schedule && onDelete) {
      onDelete(schedule);
    }
  };

  const handleComplete = () => {
    if (schedule && onComplete) {
      onComplete(schedule);
    }
  };

  const handleCancelComplete = () => {
    if (schedule && onCancelComplete) {
      onCancelComplete(schedule);
    }
  };

  const elderlyCanModify =
    !!schedule &&
    !!canElderlyModifySchedule &&
    canElderlyModifySchedule(schedule);

  const caregiverCanModify =
    !!schedule &&
    !!canCaregiverModifySchedule &&
    canCaregiverModifySchedule(schedule);

  const renderFooter = () => {
    if (!schedule || !user) {
      return null;
    }

    if (user.role === 'elderly' && schedule.creator_type === 'caregiver') {
      if (!onComplete || !onCancelComplete) {
        return null;
      }

      const isCompleted = schedule.status === 'completed';
      return (
        <>
          {!isCompleted ? (
            <TouchableOpacity
              style={modalStyles.detailCompleteButton}
              onPress={handleComplete}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
              <Text style={modalStyles.detailCompleteButtonText}>완료</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={modalStyles.detailCancelButton}
              onPress={handleCancelComplete}
              activeOpacity={0.7}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={Colors.textSecondary}
              />
              <Text style={modalStyles.detailCancelButtonText}>완료 취소</Text>
            </TouchableOpacity>
          )}
        </>
      );
    }

    if (user.role === 'elderly' && elderlyCanModify) {
      return (
        <>
          <TouchableOpacity
            style={modalStyles.detailEditButton}
            onPress={handleEdit}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <Text style={modalStyles.detailEditButtonText}>수정</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={modalStyles.detailDeleteButton}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
            <Text style={modalStyles.detailDeleteButtonText}>삭제</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (user.role === 'caregiver') {
      if (!caregiverCanModify) {
        return (
          <View style={modalStyles.detailNoticeBox}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={Colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={modalStyles.detailNoticeText}>
              어르신이 등록한 일정입니다. 보호자는 수정하거나 삭제할 수 없습니다.
            </Text>
          </View>
        );
      }

      return (
        <>
          <TouchableOpacity
            style={modalStyles.detailEditButton}
            onPress={handleEdit}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <Text style={modalStyles.detailEditButtonText}>수정</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={modalStyles.detailDeleteButton}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
            <Text style={modalStyles.detailDeleteButtonText}>삭제</Text>
          </TouchableOpacity>
        </>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={modalStyles.detailModalOverlay}>
        <View style={modalStyles.detailModalContent}>
          {schedule && (
            <>
              <View style={modalStyles.detailModalHeader}>
                <Text style={modalStyles.detailModalTitle}>일정 상세</Text>
                <TouchableOpacity onPress={onClose} style={modalStyles.detailCloseButton}>
                  <Ionicons name="close" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={modalStyles.detailModalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 0.5 }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: '700',
                      color: '#000000',
                      flex: 2,
                      marginRight: 12,
                    }}
                  >
                    {schedule.title}
                  </Text>

                  <View style={{ flexDirection: 'row' }}>
                    <View
                      style={[
                        modalStyles.detailCategoryTag,
                        schedule.category === 'MEDICINE' &&
                          modalStyles.detailCategoryMedicine,
                        schedule.category === 'HOSPITAL' &&
                          modalStyles.detailCategoryHospital,
                        schedule.category === 'EXERCISE' &&
                          modalStyles.detailCategoryExercise,
                        schedule.category === 'MEAL' &&
                          modalStyles.detailCategoryMeal,
                        { marginRight: 6 },
                      ]}
                    >
                      <Text style={modalStyles.detailCategoryText}>
                        {schedule.category === 'MEDICINE'
                          ? '약물'
                          : schedule.category === 'HOSPITAL'
                          ? '병원'
                          : schedule.category === 'EXERCISE'
                          ? '운동'
                          : schedule.category === 'MEAL'
                          ? '식사'
                          : '기타'}
                      </Text>
                    </View>

                    <View
                      style={[
                        modalStyles.detailStatusBadge,
                        schedule.status === 'completed' &&
                          modalStyles.detailStatusBadgeCompleted,
                        schedule.status === 'cancelled' &&
                          modalStyles.detailStatusBadgeCancelled,
                      ]}
                    >
                      <Text
                        style={[
                          modalStyles.detailStatusBadgeText,
                          schedule.status === 'completed' &&
                            modalStyles.detailStatusBadgeTextCompleted,
                          schedule.status === 'cancelled' &&
                            modalStyles.detailStatusBadgeTextCancelled,
                        ]}
                      >
                        {schedule.status === 'completed'
                          ? '완료'
                          : schedule.status === 'cancelled'
                          ? '취소'
                          : '예정'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color="#666666"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ fontSize: 13, color: '#666666', marginRight: 16 }}>
                    {schedule.due_date}
                  </Text>
                  {schedule.due_time && (
                    <>
                      <Ionicons
                        name="time-outline"
                        size={15}
                        color="#666666"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={{ fontSize: 13, color: '#666666' }}>
                        {formatTimeKorean(schedule.due_time)}
                      </Text>
                    </>
                  )}
                </View>

                {schedule.description && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: '#E8E8E8',
                      marginVertical: 10,
                    }}
                  />
                )}

                {schedule.description && (
                  <View
                    style={{
                      backgroundColor: '#F8F9FA',
                      paddingHorizontal: 16,
                      paddingVertical: 20,
                      borderRadius: 8,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: '#D0D0D0',
                      marginTop: 10,
                      marginBottom: 8,
                      minHeight: 150,
                    }}
                  >
                    <Text style={{ fontSize: 18, color: '#000000', lineHeight: 20 }}>
                      {schedule.description}
                    </Text>
                  </View>
                )}

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#999999', marginRight: 6 }}>
                      등록자:
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        color: '#666666',
                        fontWeight: '500',
                      }}
                    >
                      {schedule.creator_type === 'elderly'
                        ? user?.role === 'elderly'
                          ? '나'
                          : '어르신'
                        : schedule.creator_type === 'caregiver'
                        ? user?.role === 'caregiver' &&
                          schedule.creator_id === user?.user_id
                          ? '나'
                          : '보호자'
                        : 'AI'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons
                      name={schedule.is_shared_with_caregiver ? 'people' : 'lock-closed'}
                      size={14}
                      color={
                        schedule.is_shared_with_caregiver
                          ? Colors.primary
                          : '#999999'
                      }
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '500',
                        color: schedule.is_shared_with_caregiver
                          ? Colors.primary
                          : '#666666',
                      }}
                    >
                      {schedule.is_shared_with_caregiver ? '공유' : '비공유'}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <View style={modalStyles.detailModalFooter}>{renderFooter()}</View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  detailModalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModalContent: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
    width: '90%',
    alignSelf: 'center',
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  detailCloseButton: {
    padding: 4,
  },
  detailModalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  detailCategoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.primaryPale,
  },
  detailCategoryMedicine: {
    backgroundColor: Colors.errorLight,
  },
  detailCategoryHospital: {
    backgroundColor: Colors.warningLight,
  },
  detailCategoryExercise: {
    backgroundColor: Colors.successLight,
  },
  detailCategoryMeal: {
    backgroundColor: Colors.infoLight,
  },
  detailCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
  },
  detailStatusBadgeCompleted: {
    backgroundColor: '#E0F2F1',
  },
  detailStatusBadgeCancelled: {
    backgroundColor: '#FFE0E0',
  },
  detailStatusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2B6CB0',
  },
  detailStatusBadgeTextCompleted: {
    color: '#2C7A4B',
  },
  detailStatusBadgeTextCancelled: {
    color: '#C53030',
  },
  detailModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 12,
  },
  detailEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryPale,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  detailEditButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 6,
  },
  detailDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.errorLight,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  detailDeleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
    marginLeft: 6,
  },
  detailNoticeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailNoticeText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  detailCompleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryPale,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  detailCompleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 6,
  },
  detailCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
  },
  detailCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: 6,
  },
});

export default ScheduleDetailModal;
