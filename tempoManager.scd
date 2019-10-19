(
var launchpadIn, launchpadOut, drawClock, timeFwdLoop, drawPort, lastHitTime, tempo_BUTTON, phase_BUTTON, tempoRecord_BUTTON, averagingTempo, interOnsetList, refClock, tempo;

launchpadIn = ~getLaunchpadIn.(0);
launchpadOut = ~getLaunchpadOut.(0);
launchpadOut.latency = 0;
drawPort = NetAddr("127.0.0.1", 5432);

drawClock = TempoClock.new(2);
refClock = TempoClock.new;

drawClock.sched(drawClock.timeToNextBeat, {drawPort.sendMsg("/drawBeat", drawClock.beats); 1});


averagingTempo = false;
interOnsetList = List.new;
lastHitTime = 0;

tempoRecord_BUTTON = 89;
tempo_BUTTON = 79;
phase_BUTTON = 69;

(0..99).do({|i| launchpadOut.noteOff(0, tempoRecord_BUTTON, 0)});
launchpadOut.noteOn(0, tempoRecord_BUTTON, 64);

MIDIFunc.cc({|vel, note, chan, port|
    if(vel == 127, {
        if(note == tempoRecord_BUTTON, {
            var col;
            averagingTempo = averagingTempo.not;
            col = if(averagingTempo, 5, 64);
            launchpadOut.noteOn(0, tempoRecord_BUTTON, col);
            interOnsetList = List.new;
        });
        if(note == tempo_BUTTON, {
            var delta = refClock.beats - lastHitTime;
            if(delta < 1){
                var noOutliers, median, avgDelta;
                interOnsetList.add(delta);
                interOnsetList.sort;
                median = interOnsetList.median;
                noOutliers = if(interOnsetList.size > 4,
                    interOnsetList.select({|o| (o-median).abs < (0.05*median)}),
                    interOnsetList
                );
                avgDelta = noOutliers.mean;
                tempo = 1/avgDelta;
                ["TEMPO", tempo*60].postln;
            };
            lastHitTime = refClock.beats;
        });

        //stop tempo avging when you trigger phase
        if(note == phase_BUTTON, {
            averagingTempo = false;
            interOnsetList = List.new;
            launchpadOut.noteOn(0, tempoRecord_BUTTON, 64);
            drawClock.beats = drawClock.beats.ceil+1;
            drawClock.tempo = tempo;
            ["PHASE HIT", tempo*60].postln;
        });
    })



}, nil, nil, launchpadIn.uid);


timeFwdLoop = Pbind(
    \delta, 1/60,
    \play, {drawPort.sendMsg("/drawTime", drawClock.beats)}
).play;

)

a.mean
a = [1,2,3,4]