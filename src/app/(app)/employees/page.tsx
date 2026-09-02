import { getEmployeeList } from "@/lib/queries/employees";
import { EmployeesTable } from "./EmployeesTable";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const employees = await getEmployeeList();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm font-bold">Pegawai</h1>
        <p className="text-sm text-muted mt-1">
          Performa penjualan per pegawai — klik judul kolom untuk urutkan.
        </p>
      </div>

      <EmployeesTable employees={employees} />
    </div>
  );
}
