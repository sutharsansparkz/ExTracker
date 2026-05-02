import {useCallback, useEffect, useRef, useState} from 'react';
import {NativeEventEmitter, NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SmsMessage = {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
};

type SmsModuleNative = {
  setAllowedSenders(senders: string[]): void;
  getFilteredMessages(): Promise<SmsMessage[]>;
  startListening(): void;
};

const STORAGE_KEY = '@extracker.allowedSenders';

function sortMessages(messages: SmsMessage[]): SmsMessage[] {
  return [...messages].sort((left, right) => right.timestamp - left.timestamp);
}

export function useSmsModule() {
  const smsModule = NativeModules.SmsModule as SmsModuleNative | undefined;
  const smsEmitter = smsModule ? new NativeEventEmitter(smsModule as never) : null;

  const messagesByIdRef = useRef<Map<string, SmsMessage>>(new Map());
  const [allowedSenders, setAllowedSendersState] = useState<string[]>([]);
  const [messages, setMessages] = useState<SmsMessage[]>([]);

  const commitMessages = useCallback((nextMessages: SmsMessage[], replace = false) => {
    const nextMap = replace ? new Map<string, SmsMessage>() : new Map(messagesByIdRef.current);

    for (const message of nextMessages) {
      if (!nextMap.has(message.id)) {
        nextMap.set(message.id, message);
      }
    }

    messagesByIdRef.current = nextMap;
    setMessages(sortMessages(Array.from(nextMap.values())));
  }, []);

  const loadMessages = useCallback(async (senders: string[]) => {
    if (!smsModule) {
      return;
    }

    smsModule.setAllowedSenders(senders);
    const fetchedMessages = await smsModule.getFilteredMessages();
    commitMessages(fetchedMessages, true);
    smsModule.startListening();
  }, [commitMessages, smsModule]);

  const setAllowedSenders = useCallback(
    (senders: string[]) => {
      const nextSenders = senders.map(sender => sender.trim().toUpperCase()).filter(Boolean);
      setAllowedSendersState(nextSenders);

      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSenders));

      if (smsModule) {
        smsModule.setAllowedSenders(nextSenders);
      }
    },
    [smsModule],
  );

  const refresh = useCallback(async () => {
    await loadMessages(allowedSenders);
  }, [allowedSenders, loadMessages]);

  useEffect(() => {
    let isMounted = true;
    let subscription: { remove: () => void } | undefined;

    const handleIncomingSms = (message: SmsMessage) => {
      if (!isMounted) {
        return;
      }

      commitMessages([message]);
    };

    const bootstrap = async () => {
      const storedSenders = await AsyncStorage.getItem(STORAGE_KEY);
      const parsedSenders = storedSenders ? (JSON.parse(storedSenders) as string[]) : [];

      if (!isMounted) {
        return;
      }

      const nextSenders = parsedSenders.map(sender => sender.trim().toUpperCase()).filter(Boolean);
      messagesByIdRef.current = new Map();
      setAllowedSendersState(nextSenders);

      if (smsModule) {
        smsModule.setAllowedSenders(nextSenders);
      }

      await loadMessages(nextSenders);

      if (smsEmitter) {
        subscription = smsEmitter.addListener('onNewSms', handleIncomingSms);
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [commitMessages, loadMessages, smsEmitter]);

  return {messages, refresh, setAllowedSenders, allowedSenders};
}