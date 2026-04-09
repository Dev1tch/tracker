import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import TasksScreen from '../../src/features/tasks/TasksScreen';

export default function TasksRoute() {
  const { openTaskId, openTaskAt } = useLocalSearchParams<{
    openTaskId?: string;
    openTaskAt?: string;
  }>();

  return (
    <TasksScreen
      routeOpenTaskAt={typeof openTaskAt === 'string' ? openTaskAt : ''}
      routeOpenTaskId={typeof openTaskId === 'string' ? openTaskId : ''}
    />
  );
}
