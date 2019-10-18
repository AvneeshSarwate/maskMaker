(
var launchpadIn, launchpadOut, drawClock, timeFwdLoop, drawPort;

launchpadIn = ~getLaunchpadIn.(0);
launchpadOut = ~getLaunchpadOut.(0);
launchpadOut.latency = 0;
drawPort = NetAddr("127.0.0.1", 8083);

drawClock = TempoClock.new;


timeFwdLoop = Pbind(
    \delta, 1/60,

);

)


