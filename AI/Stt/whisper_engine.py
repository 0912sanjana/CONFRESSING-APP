from faster_whisper import WhisperModel

class WhisperSTT:
    def __init__(self, model_name: str, device: str, compute_type: str):
        self.model = WhisperModel(model_name, device=device, compute_type=compute_type)

    def transcribe(self, audio_path: str) -> str:
        segments, info = self.model.transcribe(audio_path, vad_filter=True)
        text_parts = []
        for seg in segments:
            if seg.text:
                text_parts.append(seg.text.strip())
        return " ".join(text_parts).strip()