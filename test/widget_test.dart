import 'package:flutter_test/flutter_test.dart';

import 'package:musicplaya/main.dart';
import 'package:musicplaya/player/player_controller.dart';

void main() {
  testWidgets('boots into the music player shell', (tester) async {
    await tester.pumpWidget(const MusicoApp(useFrontend: false));

    expect(find.text('MUSICO'), findsOneWidget);
    expect(find.text('Good evening'), findsOneWidget);
    expect(find.text('Midnight Drive'), findsNWidgets(2));
    expect(find.text('Your library starts here'), findsNothing);
  });

  testWidgets('player controls move through the current queue', (tester) async {
    await tester.pumpWidget(const MusicoApp(useFrontend: false));

    await tester.tap(find.byTooltip('Play'));
    await tester.pump();
    expect(find.byTooltip('Pause'), findsOneWidget);

    await tester.tap(find.byTooltip('Next track'));
    await tester.pump();
    expect(find.text('Paper Moon'), findsNWidgets(2));
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
