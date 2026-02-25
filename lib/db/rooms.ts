import { db } from './index'
import { rooms, roomParticipants } from './schema'
import { eq, and, isNull, lt, sql, count } from 'drizzle-orm'
import type { Room, RoomParticipant } from '@/lib/types'
import type { BoardId } from '@/lib/types'

function toRoom(row: typeof rooms.$inferSelect, participantCount?: number): Room {
  const base: Room = {
    id: row.id,
    title: row.title,
    boardId: row.boardId as BoardId,
    hostHash: row.hostHash,
    hostHandle: row.hostHandle,
    maxParticipants: row.maxParticipants,
    isLive: row.isLive,
    createdAt: row.createdAt,
    endsAt: row.endsAt,
    messageCount: row.messageCount,
  }
  if (participantCount !== undefined) base.participantCount = participantCount
  return base
}

function toParticipant(row: typeof roomParticipants.$inferSelect): RoomParticipant {
  return {
    id: row.id,
    roomId: row.roomId,
    nullifierHash: row.nullifierHash,
    displayHandle: row.displayHandle,
    identityMode: row.identityMode as RoomParticipant['identityMode'],
    joinedAt: row.joinedAt,
    leftAt: row.leftAt ?? null,
    isMuted: row.isMuted,
    isCoHost: row.isCoHost,
  }
}

// Lazily close rooms past their TTL — called on each list/get request
async function cleanupExpiredRooms(): Promise<void> {
  await db
    .update(rooms)
    .set({ isLive: false })
    .where(and(eq(rooms.isLive, true), lt(rooms.endsAt, new Date())))
}

export async function createRoom(
  hostHash: string,
  hostHandle: string,
  title: string,
  boardId: BoardId,
  maxParticipants: number
): Promise<Room> {
  const now = new Date()
  const endsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000) // +2 hours

  const [row] = await db
    .insert(rooms)
    .values({ hostHash, hostHandle, title, boardId, maxParticipants, endsAt })
    .returning()

  if (!row) throw new Error('Failed to create room')
  return toRoom(row, 0)
}

export async function getRooms(boardId?: BoardId, limit = 20): Promise<Room[]> {
  await cleanupExpiredRooms()

  const rows = await db
    .select({
      room: rooms,
      participantCount: count(roomParticipants.id),
    })
    .from(rooms)
    .leftJoin(
      roomParticipants,
      and(eq(roomParticipants.roomId, rooms.id), isNull(roomParticipants.leftAt))
    )
    .where(
      boardId
        ? and(eq(rooms.isLive, true), eq(rooms.boardId, boardId))
        : eq(rooms.isLive, true)
    )
    .groupBy(rooms.id)
    .orderBy(sql`${rooms.messageCount} DESC, ${rooms.createdAt} DESC`)
    .limit(Math.min(limit, 50))

  return rows.map((r) => toRoom(r.room, Number(r.participantCount)))
}

export async function getRoom(id: string): Promise<(Room & { participantCount: number }) | null> {
  await cleanupExpiredRooms()

  const rows = await db
    .select({
      room: rooms,
      participantCount: count(roomParticipants.id),
    })
    .from(rooms)
    .leftJoin(
      roomParticipants,
      and(eq(roomParticipants.roomId, rooms.id), isNull(roomParticipants.leftAt))
    )
    .where(eq(rooms.id, id))
    .groupBy(rooms.id)
    .limit(1)

  const r = rows[0]
  if (!r) return null
  return { ...toRoom(r.room), participantCount: Number(r.participantCount) }
}

export async function endRoom(id: string, callerHash: string): Promise<boolean> {
  const [row] = await db
    .update(rooms)
    .set({ isLive: false })
    .where(and(eq(rooms.id, id), eq(rooms.hostHash, callerHash), eq(rooms.isLive, true)))
    .returning({ id: rooms.id })

  return !!row
}

export async function joinRoom(
  roomId: string,
  nullifierHash: string,
  displayHandle: string,
  identityMode: 'anonymous' | 'alias' | 'named'
): Promise<RoomParticipant> {
  // Upsert: if they previously left, rejoin by clearing leftAt
  const existing = await db
    .select()
    .from(roomParticipants)
    .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.nullifierHash, nullifierHash)))
    .limit(1)

  if (existing[0]) {
    const [row] = await db
      .update(roomParticipants)
      .set({ leftAt: null, joinedAt: new Date(), displayHandle, identityMode })
      .where(eq(roomParticipants.id, existing[0].id))
      .returning()
    if (!row) throw new Error('Failed to rejoin room')
    return toParticipant(row)
  }

  const [row] = await db
    .insert(roomParticipants)
    .values({ roomId, nullifierHash, displayHandle, identityMode })
    .returning()

  if (!row) throw new Error('Failed to join room')
  return toParticipant(row)
}

export async function leaveRoom(roomId: string, nullifierHash: string): Promise<void> {
  await db
    .update(roomParticipants)
    .set({ leftAt: new Date() })
    .where(
      and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.nullifierHash, nullifierHash),
        isNull(roomParticipants.leftAt)
      )
    )
}

export async function getActiveParticipants(roomId: string): Promise<RoomParticipant[]> {
  const rows = await db
    .select()
    .from(roomParticipants)
    .where(and(eq(roomParticipants.roomId, roomId), isNull(roomParticipants.leftAt)))
    .orderBy(roomParticipants.joinedAt)

  return rows.map(toParticipant)
}

export async function getParticipant(
  roomId: string,
  nullifierHash: string
): Promise<RoomParticipant | null> {
  const [row] = await db
    .select()
    .from(roomParticipants)
    .where(
      and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.nullifierHash, nullifierHash),
        isNull(roomParticipants.leftAt)
      )
    )
    .limit(1)

  return row ? toParticipant(row) : null
}

export async function muteParticipant(
  roomId: string,
  targetHash: string,
  callerHash: string
): Promise<boolean> {
  // Verify caller is host
  const [room] = await db
    .select({ hostHash: rooms.hostHash })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1)

  if (!room || room.hostHash !== callerHash) return false

  const [row] = await db
    .update(roomParticipants)
    .set({ isMuted: true })
    .where(
      and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.nullifierHash, targetHash),
        isNull(roomParticipants.leftAt)
      )
    )
    .returning({ id: roomParticipants.id })

  return !!row
}

export async function kickParticipant(
  roomId: string,
  targetHash: string,
  callerHash: string
): Promise<boolean> {
  // Verify caller is host
  const [room] = await db
    .select({ hostHash: rooms.hostHash })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1)

  if (!room || room.hostHash !== callerHash) return false

  const [row] = await db
    .update(roomParticipants)
    .set({ leftAt: new Date() })
    .where(
      and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.nullifierHash, targetHash),
        isNull(roomParticipants.leftAt)
      )
    )
    .returning({ id: roomParticipants.id })

  return !!row
}

export async function incrementMessageCount(roomId: string): Promise<void> {
  await db
    .update(rooms)
    .set({ messageCount: sql`${rooms.messageCount} + 1` })
    .where(eq(rooms.id, roomId))
}
