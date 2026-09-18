import { useState } from 'react';
import { Text, View } from 'react-native';

import { Radius, Rubik, TapMin, Type } from '@/constants/theme';
import type { SessionIntervalKind } from '@/features/sessions/types/session-types';
import { useTheme } from '@/hooks/use-theme';
import { INTERVAL_LABELS } from '@/lib/format';

import { Button } from './button';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { intervalMeta } from './interval-meta';
import { Label } from './label';

export type TimelineEntry = {
  id: string;
  kind: SessionIntervalKind;
  /** Duration and temperature already formatted in the account's unit. */
  meta: string;
};

type TimelineListProps = {
  entries: TimelineEntry[];
  label?: string;
  editable?: boolean;
  onEdit?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  emptyText?: string;
};

/** The session timeline as rows: what happened, in the order it happened. */
export function TimelineList({
  entries,
  label = 'Session timeline',
  editable = false,
  onEdit,
  onDelete,
  emptyText = 'Nothing added yet.',
}: TimelineListProps) {
  const theme = useTheme();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <View>
      <Label style={{ marginBottom: 6 }}>{label}</Label>
      {entries.length === 0 ? (
        <Text
          style={{
            paddingVertical: 20,
            textAlign: 'center',
            fontFamily: Rubik.regular,
            fontSize: Type.body,
            color: theme.textSecondary,
          }}>
          {emptyText}
        </Text>
      ) : (
        <View accessibilityRole="list" style={{ gap: 2 }}>
          {entries.map((entry, index) => (
            <View key={entry.id}>
              <EntryRow
                entry={entry}
                index={index}
                total={entries.length}
                editable={editable}
                onEdit={onEdit ? () => onEdit(entry.id) : undefined}
                onDelete={onDelete ? () => setConfirmingId(entry.id) : undefined}
              />
              {confirmingId === entry.id ? (
                <View
                  style={{
                    marginHorizontal: 14,
                    marginBottom: 8,
                    padding: 12,
                    borderRadius: Radius.md,
                    backgroundColor: theme.surfaceSunken,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}>
                  <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary }}>
                    Delete this entry?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button size="sm" variant="ghost" onPress={() => setConfirmingId(null)}>Cancel</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        setConfirmingId(null);
                        onDelete?.(entry.id);
                      }}>
                      Delete
                    </Button>
                  </View>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

type EntryRowProps = {
  entry: TimelineEntry;
  index: number;
  total: number;
  editable?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  highlight?: boolean;
};

export function EntryRow({ entry, index, total, editable = false, onEdit, onDelete, highlight = false }: EntryRowProps) {
  const theme = useTheme();
  const meta = intervalMeta(entry.kind, theme);

  return (
    <View
      accessibilityLabel={`Entry ${index + 1} of ${total}: ${INTERVAL_LABELS[entry.kind]}, ${entry.meta}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: TapMin,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: Radius.md,
        backgroundColor: highlight ? theme.accentTint : 'transparent',
      }}>
      <View style={{ width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: meta.fill, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={meta.icon} size={18} color={meta.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Rubik.medium, fontSize: Type.subheading, color: theme.text }}>{meta.label}</Text>
        <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary, marginTop: 2 }}>
          {entry.meta}
        </Text>
      </View>
      {editable ? (
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {onEdit ? <IconButton icon="pencil" label={`Edit entry ${index + 1}`} size={38} onPress={onEdit} /> : null}
          {onDelete ? <IconButton icon="trash-2" label={`Delete entry ${index + 1}`} size={38} onPress={onDelete} /> : null}
        </View>
      ) : null}
    </View>
  );
}
