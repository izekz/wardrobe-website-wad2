import { describe, it, expect } from 'vitest'
import { readVideo } from '../../../src/services/styleFeedApi'

// One UNIT TEST of the real Style Feed video-file reader (no server needed).
describe('Unit — Style Feed video validation', () => {
  it('rejects unsupported/oversized files and accepts a small MP4', async () => {
    const wrongType = new File(['not a video'], 'notes.txt', { type: 'text/plain' })
    await expect(readVideo(wrongType)).rejects.toThrow('MP4 or WebM')

    const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'huge.mp4', { type: 'video/mp4' })
    await expect(readVideo(oversized)).rejects.toThrow('under 8 MB')

    const valid = new File([new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112])], 'outfit.mp4', { type: 'video/mp4' })
    await expect(readVideo(valid)).resolves.toMatch(/^data:video\/mp4;base64,/)
  })
})
