import { net } from './net';
import { pref } from './store';

/**
 * Peer-to-peer voice chat for online games (WebRTC). Our server only relays the handshake
 * (SDP + ICE) between the two players; audio flows directly between browsers, so it costs nothing.
 * On by default; "My mic" and "Opponent's voice" can be switched off in settings or in-game.
 */
export type VoiceState = 'off' | 'connecting' | 'connected' | 'failed' | 'no-mic';

const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export class VoiceChat {
  private pc: RTCPeerConnection;
  private makingOffer = false;
  private ignoreOffer = false;
  private mic: MediaStream | null = null;
  private audio = new Audio();
  private ctx: AudioContext | null = null;
  private meters: number[] = [];
  state: VoiceState = 'connecting';
  micOn = pref('micOn', true);
  hearOn = pref('hearOpponent', true);
  onChange: () => void = () => {};
  onLevel: (who: 'me' | 'them', speaking: boolean) => void = () => {};

  constructor(
    private gameId: string,
    /** Black is the "polite" peer in perfect negotiation. */
    private polite: boolean,
  ) {
    this.audio.autoplay = true;
    this.audio.muted = !this.hearOn;
    this.pc = new RTCPeerConnection({ iceServers: ICE });
    this.pc.onicecandidate = ({ candidate }) => candidate && this.signal({ candidate: candidate.toJSON() });
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        this.signal({ description: this.pc.localDescription!.toJSON() });
      } finally {
        this.makingOffer = false;
      }
    };
    this.pc.ontrack = ({ streams, track }) => {
      const stream = streams[0] ?? new MediaStream([track]);
      this.audio.srcObject = stream;
      void this.audio.play().catch(() => {});
      this.meter(stream, 'them');
    };
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      if (s === 'connected') this.set('connected');
      else if (s === 'failed') this.set('failed');
    };
    if (!polite) this.pc.addTransceiver('audio', { direction: 'sendrecv' });
    void this.attachMic();
  }

  private set(s: VoiceState): void {
    this.state = s;
    this.onChange();
  }

  private signal(data: unknown): void {
    net.send({ t: 'signal', gameId: this.gameId, data });
  }

  private async attachMic(): Promise<void> {
    if (!this.micOn || this.mic) return;
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const track = this.mic.getAudioTracks()[0];
      const tr = this.pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
      if (tr) {
        await tr.sender.replaceTrack(track);
        tr.direction = 'sendrecv';
      } else this.pc.addTrack(track, this.mic);
      this.meter(this.mic, 'me');
    } catch {
      this.micOn = false;
      this.set('no-mic');
    }
    this.onChange();
  }

  /** Handle a relayed signalling message from the opponent. */
  async handle(data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }): Promise<void> {
    try {
      if (data.description) {
        const d = data.description;
        const collision = d.type === 'offer' && (this.makingOffer || this.pc.signalingState !== 'stable');
        this.ignoreOffer = !this.polite && collision;
        if (this.ignoreOffer) return;
        await this.pc.setRemoteDescription(d);
        if (d.type === 'offer') {
          await this.attachMic();
          await this.pc.setLocalDescription();
          this.signal({ description: this.pc.localDescription!.toJSON() });
        }
      } else if (data.candidate) {
        try {
          await this.pc.addIceCandidate(data.candidate);
        } catch (e) {
          if (!this.ignoreOffer) throw e;
        }
      }
    } catch {
      /* a failed handshake leaves the game unaffected */
    }
  }

  setMic(on: boolean): void {
    this.micOn = on;
    if (on && !this.mic) void this.attachMic();
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = on));
    this.onChange();
  }

  setHear(on: boolean): void {
    this.hearOn = on;
    this.audio.muted = !on;
    this.onChange();
  }

  /** Light up the avatar while someone is talking. */
  private meter(stream: MediaStream, who: 'me' | 'them'): void {
    try {
      this.ctx ??= new AudioContext();
      const src = this.ctx.createMediaStreamSource(stream);
      const an = this.ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      let speaking = false;
      const id = window.setInterval(() => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        const now = peak > 12 && (who === 'me' ? this.micOn : this.hearOn);
        if (now !== speaking) {
          speaking = now;
          this.onLevel(who, now);
        }
      }, 120);
      this.meters.push(id);
    } catch {
      /* no WebAudio */
    }
  }

  close(): void {
    this.meters.forEach((m) => clearInterval(m));
    this.mic?.getTracks().forEach((t) => t.stop());
    this.pc.close();
    this.audio.srcObject = null;
    void this.ctx?.close().catch(() => {});
    this.state = 'off';
  }
}
