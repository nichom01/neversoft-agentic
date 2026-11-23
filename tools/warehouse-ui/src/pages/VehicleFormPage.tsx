import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useVehicle, useCreateVehicle, useUpdateVehicle } from "../api";
import { Button, Card, ErrorBox } from "../components/ui";

export function VehicleFormPage() {
  const { id: idParam } = useParams<{ id?: string }>();
  const isEdit = Boolean(idParam);
  const id = idParam ? Number(idParam) : undefined;
  const navigate = useNavigate();

  const { data: existingVehicle, isLoading, error: loadError } = useVehicle(id);
  const createMutation = useCreateVehicle();
  const updateMutation = useUpdateVehicle(id ?? 0);

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [vin, setVin] = useState("");
  const [color, setColor] = useState("");
  const [mileage, setMileage] = useState("");
  const [formError, setFormError] = useState<unknown>(null);

  useEffect(() => {
    if (existingVehicle) {
      setMake(existingVehicle.make);
      setModel(existingVehicle.model);
      setYear(String(existingVehicle.year));
      setVin(existingVehicle.vin);
      setColor(existingVehicle.color);
      setMileage(String(existingVehicle.mileage));
    }
  }, [existingVehicle]);

  const mutationError = isEdit ? updateMutation.error : createMutation.error;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedMake = make.trim();
    if (!trimmedMake || trimmedMake.length > 100) {
      setFormError(new Error("Make must be between 1 and 100 characters"));
      return;
    }

    const trimmedModel = model.trim();
    if (!trimmedModel || trimmedModel.length > 100) {
      setFormError(new Error("Model must be between 1 and 100 characters"));
      return;
    }

    const trimmedVin = vin.trim();
    if (!trimmedVin || trimmedVin.length > 64) {
      setFormError(new Error("VIN must be between 1 and 64 characters"));
      return;
    }

    const trimmedColor = color.trim();
    if (trimmedColor.length > 50) {
      setFormError(new Error("Color must be at most 50 characters"));
      return;
    }

    const yearNum = Number(year);
    const maxYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(yearNum) || yearNum < 1886 || yearNum > maxYear) {
      setFormError(new Error(`Year must be a valid integer between 1886 and ${maxYear}`));
      return;
    }

    const mileageNum = Number(mileage);
    if (!Number.isInteger(mileageNum) || mileageNum < 0) {
      setFormError(new Error("Mileage must be a non-negative integer"));
      return;
    }

    const payload = {
      make: trimmedMake,
      model: trimmedModel,
      year: yearNum,
      vin: trimmedVin,
      color: trimmedColor,
      mileage: mileageNum,
    };

    try {
      if (isEdit && id !== undefined) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate("/");
    } catch {
      // Server error is handled in mutationError / ErrorBox
    }
  };

  const handleCancel = () => {
    navigate("/");
  };

  if (isEdit && isLoading) {
    return <div className="text-sm text-slate-500 py-4">Loading vehicle details...</div>;
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800">
        {isEdit ? "Edit vehicle" : "New vehicle"}
      </h1>

      <Card className="p-6">
        {loadError ? <ErrorBox error={loadError} /> : null}
        {!loadError && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError || mutationError ? <ErrorBox error={formError || mutationError} /> : null}

            <div>
              <label htmlFor="make" className="block text-sm font-medium text-slate-700">
                Make
              </label>
              <input
                id="make"
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="model" className="block text-sm font-medium text-slate-700">
                Model
              </label>
              <input
                id="model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="year" className="block text-sm font-medium text-slate-700">
                  Year
                </label>
                <input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="mileage" className="block text-sm font-medium text-slate-700">
                  Mileage
                </label>
                <input
                  id="mileage"
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="vin" className="block text-sm font-medium text-slate-700">
                VIN
              </label>
              <input
                id="vin"
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label htmlFor="color" className="block text-sm font-medium text-slate-700">
                Color
              </label>
              <input
                id="color"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Saving..." : isEdit ? "Update vehicle" : "Create vehicle"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
