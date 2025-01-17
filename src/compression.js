export async function compress(obj) {
    const stream = new Blob([JSON.stringify(obj)])
        .stream()
        .pipeThrough(new CompressionStream("gzip"));

    const blob = await new Response(stream).blob();
    const buffer = await blob.arrayBuffer();

    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export async function decompress(base64) {
    const stream = new Blob([base64decode(base64)])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));

    const blob = await new Response(stream).blob();
    return JSON.parse(await blob.text());
}

function base64decode(str) {
    const binary = atob(str);
    const len = binary.length;
    const bytes = new Uint8Array(new ArrayBuffer(len));

    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

