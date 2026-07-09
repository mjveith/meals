import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createStateStore,
  mergeStatePatch,
  parsePutStateRequest,
  sanitizeState,
  StateRecord
} from "@/lib/state-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dataRoot = process.env.MEALS_DATA_DIR ?? process.cwd();
const store = createStateStore(dataRoot);

function createEtag(value: string) {
  return `"${createHash("sha1").update(value).digest("hex")}"`;
}

function createResponseBody(record: StateRecord) {
  return {
    version: record.version,
    ...record.state
  };
}

function jsonResponse(record: StateRecord, status = 200) {
  return NextResponse.json(createResponseBody(record), {
    status,
    headers: {
      ETag: createEtag(record.raw),
      "Cache-Control": "no-store"
    }
  });
}

export async function GET(request: NextRequest) {
  const record = await store.readStateRecord();
  const etag = createEtag(record.raw);

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "no-store"
      }
    });
  }

  return jsonResponse(record);
}

export async function PUT(request: NextRequest) {
  const parsedRequest = await parsePutStateRequest(request);

  if (!parsedRequest.ok) {
    return NextResponse.json(parsedRequest.body, { status: parsedRequest.status });
  }

  const ifMatch = request.headers.get("if-match");
  const result = await store.withStateLock(async () => {
    const current = await store.readStateRecord();
    const normalizedIfMatch = ifMatch?.replace(/^W\//, "") ?? null;

    if (normalizedIfMatch && normalizedIfMatch !== createEtag(current.raw)) {
      return { conflict: true as const, record: current };
    }

    const guardedPatch = mergeStatePatch(current.state, parsedRequest.patch);
    const nextState = sanitizeState({ ...current.state, ...guardedPatch });
    return { conflict: false as const, record: await store.writeStateRecord(nextState, current.version) };
  });

  return result.conflict ? jsonResponse(result.record, 412) : jsonResponse(result.record);
}
