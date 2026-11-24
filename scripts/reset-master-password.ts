import "dotenv/config";
import readline from "node:readline";
import { Writable } from "node:stream";
import { prisma } from "../src/lib/prisma";
import { hashPassword, checkPasswordPolicy } from "../src/lib/password";
import { revokeAllSessionsForUser } from "../src/lib/session";

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    let muted = false;
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) process.stdout.write(chunk, encoding);
        callback();
      },
    });
    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true,
    });
    process.stdout.write(question);
    muted = true;
    rl.question("", (answer) => {
      muted = false;
      process.stdout.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const targetUsername = (process.argv[2] ?? "master").trim().toLowerCase();
  if (!targetUsername) {
    console.error("Username tidak boleh kosong. Contoh: npx tsx scripts/reset-master-password.ts master");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { username: targetUsername },
    select: { id: true, username: true, role: true, isActive: true },
  });
  if (!user) {
    console.error(`Akun dengan username "${targetUsername}" tidak ditemukan di database.`);
    process.exitCode = 1;
    return;
  }

  let newPassword = process.env.NEW_PASSWORD ?? "";
  if (!newPassword) {
    newPassword = await promptHidden(`Masukkan kata sandi baru untuk "${user.username}": `);
    const confirm = await promptHidden("Ulangi kata sandi baru: ");
    if (newPassword !== confirm) {
      console.error("Konfirmasi kata sandi tidak cocok.");
      process.exitCode = 1;
      return;
    }
  }

  const policy = checkPasswordPolicy(newPassword);
  if (!policy.ok) {
    console.error(policy.error || "Kata sandi tidak memenuhi kebijakan keamanan.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, isActive: true },
  });
  await revokeAllSessionsForUser(user.id);
  await prisma.activityLog.create({
    data: {
      role: `${user.role}:${user.username}`,
      action: "RESET_PASSWORD_CLI",
      detail: `Reset kata sandi akun "${user.username}" melalui CLI server`,
    },
  });

  console.log(
    `Sukses: kata sandi akun "${user.username}" (${user.role}) telah diperbarui, diaktifkan, dan seluruh sesi lama telah dicabut.`,
  );
}

main()
  .catch((err) => {
    console.error("Gagal mereset kata sandi melalui CLI:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
