import {
  verifyCloudProof,
  type ISuccessResult,
  type IVerifyResponse,
} from '@worldcoin/minikit-js'

export async function verifyWorldIdProof(
  proof: ISuccessResult,
  action: string,
  signal?: string
): Promise<{ success: boolean; nullifierHash?: string; error?: string }> {
  const appId = process.env.APP_ID as `app_${string}`

  const response = (await verifyCloudProof(
    proof,
    appId,
    action,
    signal
  )) as IVerifyResponse

  if (response.success) {
    return {
      success: true,
      nullifierHash: proof.nullifier_hash,
    }
  }

  return {
    success: false,
    error: response.detail ?? 'Verification failed',
  }
}
