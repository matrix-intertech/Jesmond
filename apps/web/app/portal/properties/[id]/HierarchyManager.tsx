'use client';
import { useState } from 'react';
import { getAccessToken } from '@/utils/auth';

export default function HierarchyManager({ property, fetchProperty, isPending }: any) {
  const [expandedBuildings, setExpandedBuildings] = useState<string[]>([]);
  const [expandedFloors, setExpandedFloors] = useState<string[]>([]);
  const [expandedRoomTypes, setExpandedRoomTypes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  // Form States
  const [addingBuilding, setAddingBuilding] = useState(false);
  const [newBuilding, setNewBuilding] = useState({ name: '' });

  const [addingFloorTo, setAddingFloorTo] = useState<string | null>(null);
  const [newFloor, setNewFloor] = useState({ name: '', level: '' });

  const [addingRoomTypeTo, setAddingRoomTypeTo] = useState<string | null>(null); // floorId
  const [newRoomType, setNewRoomType] = useState({ name: '', description: '', price: '', inventory: '' });

  const [addingRoomTo, setAddingRoomTo] = useState<string | null>(null); // roomTypeId
  const [newRoom, setNewRoom] = useState({ identifier: '' });

  const toggleBuilding = (id: string) => setExpandedBuildings(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleFloor = (id: string) => setExpandedFloors(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleRoomType = (id: string) => setExpandedRoomTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const apiFetch = async (url: string, method: string, body?: any) => {
    const token = getAccessToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'API request failed');
    }
    return res.json();
  };

  const handleAddBuilding = async () => {
    if (submittingAction) return;
    setSubmittingAction('add-building');
    try {
      await apiFetch(`/api/v1/properties/my/${property.id}/buildings`, 'POST', newBuilding);
      setAddingBuilding(false);
      setNewBuilding({ name: '' });
      await fetchProperty();
    } catch (e: any) { setError(e.message); }
    finally { setSubmittingAction(null); }
  };

  const handleDeleteBuilding = async (bId: string) => {
    if (!confirm('Delete building?')) return;
    if (submittingAction) return;
    setSubmittingAction(`delete-building-${bId}`);
    try {
      await apiFetch(`/api/v1/properties/my/${property.id}/buildings/${bId}`, 'DELETE');
      await fetchProperty();
    } catch (e: any) { setError(e.message); }
    finally { setSubmittingAction(null); }
  };

  const handleAddFloor = async (bId: string) => {
    if (submittingAction) return;
    setSubmittingAction(`add-floor-${bId}`);
    try {
      await apiFetch(`/api/v1/properties/my/${property.id}/buildings/${bId}/floors`, 'POST', {
        name: newFloor.name,
        level: parseInt(newFloor.level)
      });
      setAddingFloorTo(null);
      setNewFloor({ name: '', level: '' });
      await fetchProperty();
    } catch (e: any) { setError(e.message); }
    finally { setSubmittingAction(null); }
  };

  const handleDeleteFloor = async (bId: string, fId: string) => {
    if (!confirm('Delete floor?')) return;
    if (submittingAction) return;
    setSubmittingAction(`delete-floor-${fId}`);
    try {
      await apiFetch(`/api/v1/properties/my/${property.id}/buildings/${bId}/floors/${fId}`, 'DELETE');
      await fetchProperty();
    } catch (e: any) { setError(e.message); }
    finally { setSubmittingAction(null); }
  };

  const handleAddRoomType = async (fId: string | null = null) => {
    if (submittingAction) return;
    setSubmittingAction(`add-room-type-${fId || 'null'}`);
    try {
      await apiFetch(`/api/v1/properties/my/${property.id}/rooms`, 'POST', {
        name: newRoomType.name,
        description: newRoomType.description,
        pricePerWeek: Math.round(parseFloat(newRoomType.price) * 100),
        inventory: parseInt(newRoomType.inventory),
        floorId: fId
      });
      setAddingRoomTypeTo(null);
      setNewRoomType({ name: '', description: '', price: '', inventory: '' });
      await fetchProperty();
    } catch (e: any) { setError(e.message); }
    finally { setSubmittingAction(null); }
  };

  const handleDeleteRoomType = async (rtId: string) => {
    if (!confirm('Delete Room Type?')) return;
    if (submittingAction) return;
    setSubmittingAction(`delete-room-type-${rtId}`);
    try {
      await apiFetch(`/api/v1/properties/my/${property.id}/rooms/${rtId}`, 'DELETE');
      await fetchProperty();
    } catch (e: any) { setError(e.message); }
    finally { setSubmittingAction(null); }
  };

  const handleAddRoom = async (rtId: string) => {
    if (submittingAction) return;
    setSubmittingAction(`add-room-${rtId}`);
    try {
      await apiFetch(`/api/v1/properties/my/${property.id}/room-types/${rtId}/rooms`, 'POST', newRoom);
      setAddingRoomTo(null);
      setNewRoom({ identifier: '' });
      await fetchProperty();
    } catch (e: any) { setError(e.message); }
    finally { setSubmittingAction(null); }
  };

  const handleDeleteRoom = async (rtId: string, rId: string) => {
    if (!confirm('Delete Room?')) return;
    if (submittingAction) return;
    setSubmittingAction(`delete-room-${rId}`);
    try {
      await apiFetch(`/api/v1/properties/my/${property.id}/room-types/${rtId}/rooms/${rId}`, 'DELETE');
      await fetchProperty();
    } catch (e: any) { setError(e.message); }
    finally { setSubmittingAction(null); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-medium">Accommodation Hierarchy</h2>
        {!isPending && (
          <button onClick={() => setAddingBuilding(true)} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-sm hover:bg-indigo-100">
            + Add Building
          </button>
        )}
      </div>

      {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

      {addingBuilding && (
        <div className="bg-gray-50 p-4 rounded border mb-4 flex gap-2 items-center">
          <input required disabled={!!submittingAction} placeholder="Building Name" value={newBuilding.name} onChange={e => setNewBuilding({name: e.target.value})} className="border rounded px-2 py-1 text-sm flex-1 disabled:opacity-50" />
          <button disabled={!!submittingAction} onClick={handleAddBuilding} className="bg-indigo-600 text-white px-3 py-1 text-sm rounded disabled:opacity-50">Save</button>
          <button disabled={!!submittingAction} onClick={() => setAddingBuilding(false)} className="text-gray-500 text-sm px-2 disabled:opacity-50">Cancel</button>
        </div>
      )}

      {/* Buildings List */}
      <div className="space-y-4">
        {property.buildings?.map((b: any) => (
          <div key={b.id} className="border rounded bg-white overflow-hidden">
            <div className="flex justify-between items-center bg-gray-50 px-4 py-3 cursor-pointer select-none" onClick={() => toggleBuilding(b.id)}>
              <span className="font-medium flex items-center gap-2">
                <span className="text-gray-400 text-xs">{expandedBuildings.includes(b.id) ? '▼' : '▶'}</span>
                {b.name}
              </span>
              {!isPending && (
                <div className="flex gap-2 items-center">
                  <button disabled={!!submittingAction} onClick={(e) => {
                    e.stopPropagation();
                    setAddingFloorTo(b.id);
                    setExpandedBuildings(prev => prev.includes(b.id) ? prev : [...prev, b.id]);
                  }} className="text-xs text-indigo-600 hover:underline disabled:opacity-50">Add Floor</button>
                  <button disabled={!!submittingAction} onClick={(e) => { e.stopPropagation(); handleDeleteBuilding(b.id); }} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                    {submittingAction === `delete-building-${b.id}` ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
            {expandedBuildings.includes(b.id) && (
              <div className="p-4 border-t space-y-4">
                {addingFloorTo === b.id && (
                  <div className="bg-gray-50 p-3 rounded border flex gap-2 items-center">
                    <input disabled={!!submittingAction} required type="number" placeholder="Level (e.g. 1)" value={newFloor.level} onChange={e => setNewFloor({...newFloor, level: e.target.value})} className="border rounded px-2 py-1 text-sm w-24 disabled:opacity-50" />
                    <input disabled={!!submittingAction} placeholder="Name (e.g. Ground Floor)" value={newFloor.name} onChange={e => setNewFloor({...newFloor, name: e.target.value})} className="border rounded px-2 py-1 text-sm flex-1 disabled:opacity-50" />
                    <button disabled={!!submittingAction} onClick={() => handleAddFloor(b.id)} className="bg-indigo-600 text-white px-3 py-1 text-sm rounded disabled:opacity-50">Save</button>
                    <button disabled={!!submittingAction} onClick={() => setAddingFloorTo(null)} className="text-gray-500 text-sm px-2 disabled:opacity-50">Cancel</button>
                  </div>
                )}
                {/* Floors List */}
                {b.floors?.length === 0 ? <p className="text-xs text-gray-500">No floors added.</p> : null}
                {b.floors?.map((f: any) => (
                  <div key={f.id} className="border border-indigo-100 rounded ml-4">
                    <div className="flex justify-between items-center bg-indigo-50/30 px-3 py-2 cursor-pointer select-none" onClick={() => toggleFloor(f.id)}>
                      <span className="font-medium text-sm flex items-center gap-2">
                        <span className="text-indigo-300 text-[10px]">{expandedFloors.includes(f.id) ? '▼' : '▶'}</span>
                        Level {f.level} {f.name ? `- ${f.name}` : ''}
                      </span>
                      {!isPending && (
                        <div className="flex gap-2 items-center">
                          <button disabled={!!submittingAction} onClick={(e) => {
                            e.stopPropagation();
                            setAddingRoomTypeTo(f.id);
                            setExpandedFloors(prev => prev.includes(f.id) ? prev : [...prev, f.id]);
                          }} className="text-xs text-indigo-600 hover:underline disabled:opacity-50">Add Room Type</button>
                          <button disabled={!!submittingAction} onClick={(e) => { e.stopPropagation(); handleDeleteFloor(b.id, f.id); }} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                            {submittingAction === `delete-floor-${f.id}` ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>
                    {expandedFloors.includes(f.id) && (
                      <div className="p-3 border-t border-indigo-100 space-y-3">
                        {addingRoomTypeTo === f.id && (
                          <div className="bg-gray-50 p-3 rounded border flex flex-col gap-2">
                            <h4 className="text-xs font-medium">New Room Type</h4>
                            <div className="flex gap-2">
                              <input disabled={!!submittingAction} placeholder="Name" value={newRoomType.name} onChange={e => setNewRoomType({...newRoomType, name: e.target.value})} className="border rounded px-2 py-1 text-sm flex-1 disabled:opacity-50" />
                              <input disabled={!!submittingAction} type="number" placeholder="Price/wk ($)" value={newRoomType.price} onChange={e => setNewRoomType({...newRoomType, price: e.target.value})} className="border rounded px-2 py-1 text-sm w-28 disabled:opacity-50" />
                              <input disabled={!!submittingAction} type="number" placeholder="Inventory" value={newRoomType.inventory} onChange={e => setNewRoomType({...newRoomType, inventory: e.target.value})} className="border rounded px-2 py-1 text-sm w-24 disabled:opacity-50" />
                            </div>
                            <input disabled={!!submittingAction} placeholder="Description" value={newRoomType.description} onChange={e => setNewRoomType({...newRoomType, description: e.target.value})} className="border rounded px-2 py-1 text-sm w-full disabled:opacity-50" />
                            <div className="flex gap-2 justify-end">
                              <button disabled={!!submittingAction} onClick={() => setAddingRoomTypeTo(null)} className="text-gray-500 text-xs px-2 disabled:opacity-50">Cancel</button>
                              <button disabled={!!submittingAction} onClick={() => handleAddRoomType(f.id)} className="bg-indigo-600 text-white px-3 py-1 text-xs rounded disabled:opacity-50">Save</button>
                            </div>
                          </div>
                        )}
                        {/* RoomTypes List */}
                        {f.roomTypes?.length === 0 ? <p className="text-xs text-gray-500">No room types assigned.</p> : null}
                        {f.roomTypes?.map((rt: any) => (
                          <div key={rt.id} className="border border-purple-100 rounded ml-4">
                            <div className="flex justify-between items-center bg-purple-50/30 px-3 py-2 cursor-pointer select-none" onClick={() => toggleRoomType(rt.id)}>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-purple-300 text-[10px]">{expandedRoomTypes.includes(rt.id) ? '▼' : '▶'}</span>
                                <span className="font-medium text-purple-900">{rt.name}</span>
                                <span className="text-purple-600 text-xs">${rt.pricePerWeek / 100}/wk</span>
                                <span className="text-gray-400 text-xs">Inv: {rt.inventory}</span>
                              </div>
                              {!isPending && (
                                <div className="flex gap-2 items-center">
                                  <button disabled={!!submittingAction} onClick={(e) => {
                                    e.stopPropagation();
                                    setAddingRoomTo(rt.id);
                                    setExpandedRoomTypes(prev => prev.includes(rt.id) ? prev : [...prev, rt.id]);
                                  }} className="text-[11px] text-indigo-600 hover:underline disabled:opacity-50">Add Room</button>
                                  <button disabled={!!submittingAction} onClick={(e) => { e.stopPropagation(); handleDeleteRoomType(rt.id); }} className="text-[11px] text-red-600 hover:underline disabled:opacity-50">
                                    {submittingAction === `delete-room-type-${rt.id}` ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              )}
                            </div>
                            {expandedRoomTypes.includes(rt.id) && (
                              <div className="p-3 border-t border-purple-100">
                                <p className="text-xs text-gray-500 mb-2">{rt.description}</p>

                                {addingRoomTo === rt.id && (
                                  <div className="bg-white p-2 mb-2 rounded border flex gap-2 items-center">
                                    <input disabled={!!submittingAction} placeholder="Room Identifier (e.g. 101)" value={newRoom.identifier} onChange={e => setNewRoom({identifier: e.target.value})} className="border rounded px-2 py-1 text-xs flex-1 disabled:opacity-50" />
                                    <button disabled={!!submittingAction} onClick={() => handleAddRoom(rt.id)} className="bg-indigo-600 text-white px-2 py-1 text-xs rounded disabled:opacity-50">Save</button>
                                    <button disabled={!!submittingAction} onClick={() => setAddingRoomTo(null)} className="text-gray-500 text-xs px-1 disabled:opacity-50">Cancel</button>
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-2 mt-2">
                                  {rt.rooms?.length === 0 ? <span className="text-xs text-gray-400 italic">No specific rooms added yet.</span> : null}
                                  {rt.rooms?.map((r: any) => (
                                    <div key={r.id} className="bg-white border border-gray-200 px-2 py-1 rounded text-xs flex items-center gap-2">
                                      <span className="font-medium">{r.identifier}</span>
                                      {!isPending && (
                                        <button disabled={!!submittingAction} onClick={() => handleDeleteRoom(rt.id, r.id)} className="text-red-400 hover:text-red-600 disabled:opacity-50">✕</button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Unassigned Room Types (for backward compatibility) */}
      {property.roomTypes?.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-4 uppercase tracking-wider">Unassigned Room Types</h3>
          <div className="space-y-3">
            {property.roomTypes.map((rt: any) => (
              <div key={rt.id} className="border border-purple-100 rounded bg-white">
                <div className="flex justify-between items-center bg-purple-50/30 px-3 py-2 cursor-pointer select-none" onClick={() => toggleRoomType(rt.id)}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-purple-300 text-[10px]">{expandedRoomTypes.includes(rt.id) ? '▼' : '▶'}</span>
                    <span className="font-medium text-purple-900">{rt.name}</span>
                    <span className="text-purple-600 text-xs">${rt.pricePerWeek / 100}/wk</span>
                    <span className="text-gray-400 text-xs">Inv: {rt.inventory}</span>
                  </div>
                  {!isPending && (
                    <div className="flex gap-2 items-center">
                      <button disabled={!!submittingAction} onClick={(e) => { e.stopPropagation(); handleDeleteRoomType(rt.id); }} className="text-[11px] text-red-600 hover:underline disabled:opacity-50">
                        {submittingAction === `delete-room-type-${rt.id}` ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
                {expandedRoomTypes.includes(rt.id) && (
                  <div className="p-3 border-t border-purple-100">
                    <p className="text-xs text-gray-500 mb-2">{rt.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {rt.rooms?.length === 0 ? <span className="text-xs text-gray-400 italic">No specific rooms added yet.</span> : null}
                      {rt.rooms?.map((r: any) => (
                        <div key={r.id} className="bg-white border border-gray-200 px-2 py-1 rounded text-xs flex items-center gap-2">
                          <span className="font-medium">{r.identifier}</span>
                          {!isPending && (
                            <button disabled={!!submittingAction} onClick={() => handleDeleteRoom(rt.id, r.id)} className="text-red-400 hover:text-red-600 disabled:opacity-50">✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
