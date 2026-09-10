import 'package:flutter_test/flutter_test.dart';

import 'package:musicplaya/main.dart';
import 'package:musicplaya/frontend/frontend_screen.dart';
import 'package:musicplaya/player/player_controller.dart';

void main() {
  testWidgets('boots into MusicoApp with FrontendScreen', (tester) async {
    await tester.pumpWidget(const MusicoApp());

    expect(find.byType(FrontendScreen), findsOneWidget);
  });

  test('queue controller changes queue and reorders tracks', () {
    final controller = PlayerController();

    controller.selectQueue(1);
    expect(controller.currentQueue.name, 'Focus Room');
    expect(controller.currentTrack.title, 'Paper Moon');

    controller.selectQueue(0);
    controller.reorderCurrentTrack(0, 2);
    expect(controller.currentQueue.tracks[1].title, 'Midnight Drive');
  });
}
