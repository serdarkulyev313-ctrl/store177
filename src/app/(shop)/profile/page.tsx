"use client";

import { PackageOpen, UserRound } from "lucide-react";

import { Card } from "@/components/ui/card";
import { AppHeader } from "../_components/AppHeader";
import { PageContainer } from "../_components/PageContainer";
import { SectionTitle } from "../_components/SectionTitle";
import { useTelegram } from "../_hooks/useTelegram";

export default function ProfilePage() {
  const { user } = useTelegram();

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") || `@${user.username}`
    : "Гость";

  return (
    <PageContainer className="space-y-5">
      <AppHeader />

      <div className="space-y-3">
        <SectionTitle>Профиль</SectionTitle>
        <div className="text-base font-semibold text-slate-900">Ваши данные</div>
      </div>

      <Card className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <UserRound className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{displayName}</div>
          <div className="text-xs text-slate-500">
            {user?.username ? `@${user.username}` : "Телеграм-аккаунт не определён"}
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <SectionTitle>Заказы</SectionTitle>
        <div className="text-base font-semibold text-slate-900">История заказов</div>
      </div>

      <Card className="flex flex-col items-center gap-2 p-6 text-center text-sm text-slate-600">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <PackageOpen className="h-5 w-5 text-slate-400" />
        </div>
        <div className="font-semibold text-slate-900">Заказов пока нет</div>
        <div>Создайте заказ, чтобы увидеть его статус здесь.</div>
      </Card>
    </PageContainer>
  );
}
