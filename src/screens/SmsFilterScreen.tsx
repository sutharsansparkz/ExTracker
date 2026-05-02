import React, {useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SmsMessage, useSmsModule} from '../hooks/useSmsModule';

function parseSenderInput(input: string) {
  return input
    .split(',')
    .map(sender => sender.trim().toUpperCase())
    .filter(Boolean);
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

function MessageRow({item}: {item: SmsMessage}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sender}>{item.sender}</Text>
      <Text style={styles.body} numberOfLines={3}>
        {item.body}
      </Text>
      <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
    </View>
  );
}

export function SmsFilterScreen() {
  const {messages, refresh, setAllowedSenders, allowedSenders} = useSmsModule();
  const [senderInput, setSenderInput] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  React.useEffect(() => {
    setSenderInput(allowedSenders.join(', '));
  }, [allowedSenders]);

  const handleApplyFilter = async () => {
    const parsedSenders = parseSenderInput(senderInput);
    const normalizedInput = parsedSenders.join(', ');

    setSenderInput(normalizedInput);
    setAllowedSenders(parsedSenders);

    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>SMS Filter</Text>
      <Text style={styles.subtitle}>Enter one or more sender codes separated by commas.</Text>

      <TextInput
        value={senderInput}
        onChangeText={setSenderInput}
        placeholder="HDFCBK, ICICIB"
        placeholderTextColor="#64748B"
        autoCapitalize="characters"
        autoCorrect={false}
        style={styles.input}
      />

      <Pressable onPress={handleApplyFilter} style={styles.button}>
        <Text style={styles.buttonText}>Apply Filter</Text>
      </Pressable>

      {isRefreshing ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Refreshing messages...</Text>
        </View>
      ) : null}

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({item}) => <MessageRow item={item} />}
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No messages found</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
    padding: 16,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#121A33',
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#223056',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2D6BFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingText: {
    color: '#CBD5E1',
    marginLeft: 10,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#121A33',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#223056',
  },
  sender: {
    color: '#8FB3FF',
    fontWeight: '700',
    marginBottom: 6,
  },
  body: {
    color: '#E5E7EB',
    marginBottom: 8,
    lineHeight: 20,
  },
  timestamp: {
    color: '#94A3B8',
    fontSize: 12,
  },
});