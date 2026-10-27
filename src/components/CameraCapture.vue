<script>
import CommunityIcon from './CommunityIcon.vue'
export default {
  components: { CommunityIcon },
  props: { disabled: { type: Boolean, default: false } },
  emits: ['photo', 'choose-file'],
  data() { return { stream: null, ready: false, busy: false, starting: false, error: '', attempt: 0 } },
  methods: {
    async openCamera() {
      if (this.disabled || this.$refs.dialog.open) return
      this.error = ''; this.ready = false; this.starting = true
      this.$refs.dialog.showModal()
      const attempt = ++this.attempt
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera preview needs HTTPS or localhost in a supported browser. You can still upload a photo.')
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        // Permission may finish after the user closes the dialog or changes page.
        if (attempt !== this.attempt) { stream.getTracks().forEach(track => track.stop()); return }
        this.stream = stream
        this.$refs.video.srcObject = stream
        await this.$refs.video.play()
      } catch (error) {
        if (attempt !== this.attempt) return
        this.stopStream()
        this.error = error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser, or upload a photo.'
          : error.name === 'NotFoundError' ? 'No camera was found. Please upload a photo instead.'
          : error.name === 'NotReadableError' ? 'The camera is unavailable or being used by another app. Close that app or upload a photo.'
          : error.message || 'The camera could not start. Please upload a photo instead.'
      } finally { if (attempt === this.attempt) this.starting = false }
    },
    stopStream() {
      this.stream?.getTracks().forEach(track => track.stop())
      this.stream = null; this.ready = false; this.starting = false
      if (this.$refs.video) this.$refs.video.srcObject = null
    },
    closeCamera() {
      this.attempt++; this.busy = false; this.stopStream()
      if (this.$refs.dialog?.open) this.$refs.dialog.close()
    },
    chooseFile() { this.closeCamera(); this.$emit('choose-file') },
    async takePhoto() {
      const video = this.$refs.video
      if (!this.ready || this.busy || !video.videoWidth || !video.videoHeight) return
      const attempt = this.attempt
      this.busy = true; this.error = ''
      try {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight))
        canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale)
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88))
        if (attempt !== this.attempt) return
        if (!blob) throw new Error('The photo could not be captured. Try again or upload a photo.')
        this.$emit('photo', new File([blob], 'clothing-camera.jpg', { type: 'image/jpeg' }))
        this.closeCamera()
      } catch (error) { if (attempt === this.attempt) this.error = error.message }
      finally { this.busy = false }
    },
  },
  beforeUnmount() { this.closeCamera() },
}
</script>
<template>
  <button type="button" class="community-btn community-btn-outline w-100 mb-3" :disabled="disabled" @click="openCamera"><CommunityIcon name="camera" :size="23" /> Take a photo</button>
  <dialog ref="dialog" class="camera-dialog" aria-label="Take a clothing photo" @cancel.prevent="closeCamera" @close="stopStream">
    <div class="d-flex justify-content-between align-items-center gap-3 mb-3"><h2 class="h4 mb-0">Take a photo</h2><button type="button" class="community-icon-button" aria-label="Close camera" @click="closeCamera"><CommunityIcon name="close" /></button></div>
    <p v-if="starting" role="status">Allow camera access in your browser to see the preview.</p>
    <p v-if="error" class="community-error" role="alert">{{ error }}</p>
    <video v-show="!error" ref="video" autoplay muted playsinline class="camera-preview" aria-label="Camera preview" @loadedmetadata="ready = true" />
    <div class="d-flex flex-wrap gap-2 mt-3">
      <button type="button" class="community-btn" :disabled="!ready || busy" @click="takePhoto"><CommunityIcon name="camera" /> {{ busy ? 'Capturing…' : 'Capture photo' }}</button>
      <button type="button" class="community-btn community-btn-outline" @click="chooseFile">Upload a photo instead</button>
      <button type="button" class="community-text-button" @click="closeCamera">Cancel</button>
    </div>
  </dialog>
</template>
