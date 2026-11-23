import { useState } from "react";
import { Link } from "react-router-dom";
import { useVehicles, useDeleteVehicle, type Vehicle } from "../api";
import { Button, Card, ErrorBox } from "../components/ui";

export function VehicleListPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [pendingDelete, setPendingDelete] = useState<Vehicle | null>(null);
  const [deleteError, setDeleteError] = useState<unknown>(null);

  const { data, isLoading, error } = useVehicles({ q, page, pageSize });
  const deleteMutation = useDeleteVehicle();

  const handleSearchChange = (newQ: string) => {
    setQ(newQ);
    setPage(1);
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = data?.items ?? [];

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err);
    }
  };

  const handleCancelDelete = () => {
    setPendingDelete(null);
    setDeleteError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Vehicles</h1>
        <Link to="/vehicles/new">
          <Button variant="primary">New vehicle</Button>
        </Link>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search vehicles..."
            value={q}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        {isLoading && <div className="text-sm text-slate-500 py-4">Loading vehicles...</div>}

        {error ? <ErrorBox error={error} /> : null}

        {!isLoading && !error && items.length === 0 && (
          <div className="text-sm text-slate-500 py-4">No vehicles found.</div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Make</th>
                  <th className="px-4 py-2">Model</th>
                  <th className="px-4 py-2">Year</th>
                  <th className="px-4 py-2">VIN</th>
                  <th className="px-4 py-2">Color</th>
                  <th className="px-4 py-2">Mileage</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs">{vehicle.id}</td>
                    <td className="px-4 py-2">{vehicle.make}</td>
                    <td className="px-4 py-2">{vehicle.model}</td>
                    <td className="px-4 py-2">{vehicle.year}</td>
                    <td className="px-4 py-2 font-mono text-xs">{vehicle.vin}</td>
                    <td className="px-4 py-2">{vehicle.color}</td>
                    <td className="px-4 py-2">{vehicle.mileage.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <Link to={`/vehicles/${vehicle.id}/edit`}>
                        <Button variant="ghost" className="px-2 py-1 text-xs">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="danger"
                        className="px-2 py-1 text-xs"
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDelete(vehicle);
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-sm text-slate-600">
            page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              Previous
            </Button>
            <Button
              variant="default"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Overlay */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md p-6 space-y-4 bg-white shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Delete vehicle</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {pendingDelete.make} {pendingDelete.model}
              </span>{" "}
              (VIN: <span className="font-mono text-xs">{pendingDelete.vin}</span>)?
            </p>

            {deleteError ? <ErrorBox error={deleteError} /> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={handleCancelDelete}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Confirm"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
