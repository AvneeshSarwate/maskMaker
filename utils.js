var mix = (n1, n2, a) => n1*(1-a) + n2*a;
var rand = n => (sin(n) * 1e4)%1;

function noise(x) {
    let i = Math.floor(x);
    let f = x%1;
    let u = f * f * (3.0 - 2.0 * f);
    return mix(rand(i), rand(i + 1.0), u);
}