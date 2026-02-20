import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:tapdeck/core/pairing/pairing_client.dart';

class DeckSlotUpdate {
  const DeckSlotUpdate({required this.label, required this.name});

  final String label;
  final String? name;
}

class DeckSyncClient {
  DeckSyncClient({required this.payload});

  final PairingPayload payload;

  WebSocketChannel? _channel;
  StreamSubscription? _sub;
  final StreamController<List<DeckSlotUpdate>> _controller =
      StreamController<List<DeckSlotUpdate>>.broadcast();

  Stream<List<DeckSlotUpdate>> get stream => _controller.stream;

  Future<void> connect() async {
    if (_channel != null) return;

    final uri = Uri(scheme: 'ws', host: payload.ip, port: payload.port);
    _channel = WebSocketChannel.connect(uri);

    _sub = _channel!.stream.listen(
      _handleMessage,
      onError: (err) => _controller.addError(err),
      onDone: () => _controller.addError('Connection closed'),
    );

    _channel!.sink.add(
      json.encode({
        'type': 'deck_subscribe',
        'token': payload.token,
      }),
    );
  }

  void requestSync() {
    if (_channel == null) return;
    _channel!.sink.add(
      json.encode({
        'type': 'deck_sync_request',
        'token': payload.token,
      }),
    );
  }

  void dispose() {
    _sub?.cancel();
    _channel?.sink.close();
    _controller.close();
  }

  void _handleMessage(dynamic raw) {
    try {
      final data = json.decode(raw as String) as Map<String, dynamic>;
      final type = data['type'] as String?;
      if (type != 'deck_update') return;

      final slots = (data['slots'] as List<dynamic>? ?? [])
          .map((item) {
            final map = item as Map<String, dynamic>;
            final label = (map['label'] as String?) ?? 'Slot';
            final name = map['name'] as String? ?? map['payload'] as String?;
            return DeckSlotUpdate(label: label, name: name);
          })
          .toList();

      _controller.add(slots);
    } catch (_) {
      _controller.addError('Invalid deck update received.');
    }
  }
}
