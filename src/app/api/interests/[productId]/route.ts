import { NextRequest, NextResponse } from 'next/server';
import {
  ProductNotFoundError,
  putBuyerInterest,
  removeBuyerInterest,
} from '../../../../modules/interests/application/manage-interests';
import { interestProductIdSchema } from '../../../../modules/interests/contracts/interests.contract';
import { hasNonEmptyBody, interestsNoStore, resolveInterestUser } from '../_auth';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ productId: string }> };

async function validateInput(request: NextRequest, context: RouteContext) {
  const parsedId = interestProductIdSchema.safeParse((await context.params).productId);
  if (!parsedId.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'INVALID_PRODUCT_ID', message: 'Некорректный товар.' } },
        { status: 400, headers: interestsNoStore },
      ),
    } as const;
  }

  if (request.nextUrl.searchParams.size > 0 || await hasNonEmptyBody(request)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'INVALID_INTEREST_INPUT', message: 'Некорректный запрос интереса.' } },
        { status: 400, headers: interestsNoStore },
      ),
    } as const;
  }

  return { ok: true, productId: parsedId.data } as const;
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  const auth = await resolveInterestUser(request);
  if (!auth.ok) return auth.response;
  const input = await validateInput(request, context);
  if (!input.ok) return input.response;

  try {
    const interest = await putBuyerInterest(auth.user.id, input.productId);
    return NextResponse.json({ interest }, { status: 200, headers: interestsNoStore });
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404, headers: interestsNoStore },
      );
    }
    console.error('Interest save failed');
    return NextResponse.json(
      { error: { code: 'INTERESTS_UNAVAILABLE', message: 'Не удалось сохранить интерес.' } },
      { status: 503, headers: interestsNoStore },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const auth = await resolveInterestUser(request);
  if (!auth.ok) return auth.response;
  const input = await validateInput(request, context);
  if (!input.ok) return input.response;

  try {
    await removeBuyerInterest(auth.user.id, input.productId);
    return new Response(null, { status: 204, headers: interestsNoStore });
  } catch {
    console.error('Interest removal failed');
    return NextResponse.json(
      { error: { code: 'INTERESTS_UNAVAILABLE', message: 'Не удалось удалить интерес.' } },
      { status: 503, headers: interestsNoStore },
    );
  }
}
