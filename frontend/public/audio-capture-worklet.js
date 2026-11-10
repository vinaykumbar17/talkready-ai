
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];

    if (output) {
      output.fill(0);
    }

    if (input) {
      let position = 0;

      while (position < input.length) {
        const count = Math.min(
          input.length - position,
          this.bufferSize - this.offset
        );

        this.buffer.set(
          input.subarray(position, position + count),
          this.offset
        );

        this.offset += count;
        position += count;

        if (this.offset === this.bufferSize) {
          const chunk = this.buffer;

          this.port.postMessage(chunk, [chunk.buffer]);

          this.buffer = new Float32Array(this.bufferSize);
          this.offset = 0;
        }
      }
    }

    return true;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
